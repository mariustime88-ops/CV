<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Middleware\EnsureCvAdminSession;
use App\Models\CvProfile;
use DOMDocument;
use DOMElement;
use DOMNode;
use DOMText;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class CvProfileController extends Controller
{
    public function show(): JsonResponse
    {
        $profile = CvProfile::query()->firstOrCreate(
            ['id' => 1],
            CvProfile::defaults(),
        );

        return response()->json($profile);
    }

    public function update(Request $request): JsonResponse
    {
        if ($request->hasFile('photo')) {
            $request->validate([
                'profile_data' => ['required', 'json'],
                'photo' => ['required', 'image', 'mimes:jpeg,png,webp', 'max:5120'],
            ]);

            $profileData = json_decode($request->input('profile_data'), true);

            if (! is_array($profileData)) {
                throw ValidationException::withMessages([
                    'profile_data' => 'The profile data must be a JSON object.',
                ]);
            }

            array_walk_recursive($profileData, static function (&$value): void {
                if ($value === '') {
                    $value = null;
                }
            });

            $request->merge($profileData);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:160'],
            'title' => ['required', 'string', 'max:160'],
            'profile' => ['required', 'string', 'max:10000'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:80'],
            'location' => ['nullable', 'string', 'max:160'],
            'website' => ['nullable', 'url', 'max:2048'],
            'photo_url' => ['nullable', 'url', 'max:2048'],
            'languages' => ['present', 'array'],
            'languages.*.name' => ['required', 'string', 'max:500'],
            'languages.*.level' => ['required', 'integer', 'between:0,100'],
            'skills' => ['present', 'array'],
            'skills.*.name' => ['required', 'string', 'max:500'],
            'skills.*.level' => ['required', 'integer', 'between:0,100'],
            'hobbies' => ['present', 'array'],
            'hobbies.*' => ['required', 'string', 'max:100'],
            'education' => ['present', 'array'],
            'education.*.period' => ['required', 'string', 'max:100'],
            'education.*.title' => ['required', 'string', 'max:160'],
            'education.*.organization' => ['required', 'string', 'max:160'],
            'education.*.description' => ['required', 'string', 'max:5000'],
            'experience' => ['present', 'array'],
            'experience.*.period' => ['required', 'string', 'max:100'],
            'experience.*.title' => ['required', 'string', 'max:160'],
            'experience.*.organization' => ['required', 'string', 'max:160'],
            'experience.*.description' => ['required', 'string', 'max:5000'],
            'achievements' => ['present', 'array'],
            'achievements.*' => ['required', 'string', 'max:1000'],
        ]);

        if ($request->hasFile('photo')) {
            $path = $request->file('photo')->store('cv-photos', 'public');

            if ($path === false) {
                abort(500, 'The uploaded photo could not be stored.');
            }

            $validated['photo_url'] = Storage::disk('public')->url($path);
        }

        $validated['profile'] = $this->sanitizeRichText($validated['profile']);

        foreach (['education', 'experience'] as $section) {
            foreach ($validated[$section] as $index => $entry) {
                $validated[$section][$index]['description'] = $this->sanitizeRichText(
                    $entry['description'],
                );
            }
        }

        Cache::put(
            EnsureCvAdminSession::cacheKey((string) $request->bearerToken()),
            true,
            now()->addHours(8),
        );

        $profile = CvProfile::query()->firstOrCreate(
            ['id' => 1],
            CvProfile::defaults(),
        );
        $profile->fill($validated)->save();

        return response()->json($profile->fresh());
    }

    private function sanitizeRichText(string $html): string
    {
        $document = new DOMDocument('1.0', 'UTF-8');
        $previousErrorSetting = libxml_use_internal_errors(true);
        $document->loadHTML(
            '<?xml encoding="UTF-8"><div>'.$html.'</div>',
            LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD,
        );
        libxml_clear_errors();
        libxml_use_internal_errors($previousErrorSetting);

        $root = $document->getElementsByTagName('div')->item(0);

        if (! $root) {
            return '';
        }

        $this->sanitizeNodes($root);

        $sanitized = '';
        foreach ($root->childNodes as $child) {
            $sanitized .= $document->saveHTML($child);
        }

        return $sanitized;
    }

    private function sanitizeNodes(DOMNode $parent): void
    {
        $allowedTags = ['p', 'div', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'blockquote', 'h2', 'h3', 'a'];
        $discardedTags = ['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math'];

        foreach (iterator_to_array($parent->childNodes) as $child) {
            if ($child instanceof DOMElement) {
                $tag = strtolower($child->tagName);

                if (in_array($tag, $discardedTags, true)) {
                    $parent->removeChild($child);

                    continue;
                }

                $this->sanitizeNodes($child);

                if (! in_array($tag, $allowedTags, true)) {
                    while ($child->firstChild) {
                        $parent->insertBefore($child->firstChild, $child);
                    }

                    $parent->removeChild($child);

                    continue;
                }

                foreach (iterator_to_array($child->attributes) as $attribute) {
                    if ($tag !== 'a' || $attribute->name !== 'href') {
                        $child->removeAttribute($attribute->name);
                    }
                }

                if ($tag === 'a') {
                    $href = $child->getAttribute('href');
                    $scheme = strtolower((string) parse_url($href, PHP_URL_SCHEME));

                    if (! in_array($scheme, ['http', 'https', 'mailto'], true)) {
                        $child->removeAttribute('href');
                    }
                }
            } elseif (! $child instanceof DOMText) {
                $parent->removeChild($child);
            }
        }
    }
}
