<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CvProfileApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_public_cv_endpoint_returns_the_starter_profile(): void
    {
        $response = $this->getJson('/api/cv');

        $response
            ->assertOk()
            ->assertJsonPath('name', 'Votre nom')
            ->assertJsonPath('experience', []);
    }

    public function test_admin_login_returns_a_temporary_token_for_the_correct_password(): void
    {
        config(['services.cv.admin_password' => 'test-admin-password']);

        $this->postJson('/api/admin/login', ['password' => 'incorrect'])
            ->assertUnauthorized();

        $this->postJson('/api/admin/login', ['password' => 'test-admin-password'])
            ->assertOk()
            ->assertJsonPath('expires_in', 28800)
            ->assertJsonStructure(['token']);
    }

    public function test_admin_login_is_disabled_without_a_configured_password(): void
    {
        config(['services.cv.admin_password' => '']);

        $this->postJson('/api/admin/login', ['password' => 'any-password'])
            ->assertServiceUnavailable();
    }

    public function test_cv_updates_require_a_valid_admin_session_and_sanitize_rich_text(): void
    {
        config(['services.cv.admin_password' => 'test-admin-password']);

        $this->putJson('/api/cv', $this->validProfile())
            ->assertUnauthorized();

        $token = $this->adminToken();
        $profile = $this->validProfile();
        $profile['profile'] = '<p><strong>Présentation</strong><script>alert(1)</script><img src=x onerror=alert(2)></p>';
        $profile['skills'][0]['name'] = rtrim(str_repeat('Compétence ', 20));
        $profile['experience'][0]['description'] = '<ul><li>Réalisation</li><li><a href="javascript:alert(1)">Lien</a></li></ul>';

        $this->withToken($token)
            ->putJson('/api/cv', $profile)
            ->assertOk()
            ->assertJsonPath('name', 'Ada Lovelace')
            ->assertJsonPath('profile', '<p><strong>Présentation</strong></p>')
            ->assertJsonPath('skills.0.name', $profile['skills'][0]['name'])
            ->assertJsonPath('experience.0.description', '<ul><li>Réalisation</li><li><a>Lien</a></li></ul>');

        $this->withToken($token)
            ->deleteJson('/api/admin/session')
            ->assertOk();

        $this->withToken($token)
            ->putJson('/api/cv', $this->validProfile())
            ->assertUnauthorized();
    }

    public function test_cv_updates_validate_required_experience_fields(): void
    {
        config(['services.cv.admin_password' => 'test-admin-password']);
        $profile = $this->validProfile();
        $profile['experience'][0]['title'] = '';

        $this->withToken($this->adminToken())
            ->putJson('/api/cv', $profile)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('experience.0.title');

        $this->assertDatabaseMissing('cv_profiles', ['name' => 'Ada Lovelace']);
    }

    public function test_cv_can_be_updated_with_a_photo_uploaded_from_the_device(): void
    {
        config(['services.cv.admin_password' => 'test-admin-password']);
        Storage::fake('public');

        $profile = $this->validProfile();
        $response = $this->withToken($this->adminToken())
            ->post('/api/cv', [
                'profile_data' => json_encode($profile, JSON_THROW_ON_ERROR),
                'photo' => UploadedFile::fake()->image('portrait.png'),
            ]);

        $response
            ->assertOk()
            ->assertJsonPath('name', 'Ada Lovelace');

        $photoUrl = $response->json('photo_url');
        $this->assertStringContainsString('/storage/cv-photos/', $photoUrl);

        $storedPath = ltrim(substr(parse_url($photoUrl, PHP_URL_PATH), strlen('/storage/')), '/');
        Storage::disk('public')->assertExists($storedPath);
    }

    public function test_preflight_requests_allow_the_configured_frontend_origin(): void
    {
        config(['cors.allowed_origins' => ['https://mon-cv.vercel.app']]);

        foreach (['POST', 'DELETE'] as $method) {
            $response = $this->withHeaders([
                'Origin' => 'https://mon-cv.vercel.app',
                'Access-Control-Request-Method' => $method,
                'Access-Control-Request-Headers' => 'content-type,authorization',
            ])->options('/api/cv');

            $response
                ->assertNoContent()
                ->assertHeader('Access-Control-Allow-Origin', 'https://mon-cv.vercel.app');
            $this->assertStringContainsString($method, $response->headers->get('Access-Control-Allow-Methods', ''));
        }
    }

    private function validProfile(): array
    {
        return [
            'name' => 'Ada Lovelace',
            'title' => 'Développeuse',
            'profile' => 'Présentation professionnelle.',
            'email' => 'ada@example.com',
            'phone' => '',
            'location' => 'Paris',
            'website' => '',
            'photo_url' => '',
            'languages' => [['name' => 'Français', 'level' => 100]],
            'skills' => [['name' => 'PHP', 'level' => 80]],
            'hobbies' => ['Lecture'],
            'education' => [],
            'experience' => [[
                'period' => '2024 – aujourd’hui',
                'title' => 'Développeuse',
                'organization' => 'Entreprise',
                'description' => 'Description du poste.',
            ]],
            'achievements' => ['Premier projet livré'],
        ];
    }

    private function adminToken(): string
    {
        return $this->postJson('/api/admin/login', [
            'password' => 'test-admin-password',
        ])->assertOk()->json('token');
    }
}
