<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Middleware\EnsureCvAdminSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class CvAdminController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'password' => ['required', 'string', 'max:255'],
        ]);
        $expectedPassword = (string) config('services.cv.admin_password');

        if ($expectedPassword === '') {
            return response()->json([
                'message' => 'L’accès administrateur n’est pas encore configuré sur le serveur.',
            ], 503);
        }

        if (! hash_equals($expectedPassword, $validated['password'])) {
            return response()->json([
                'message' => 'Mot de passe incorrect.',
            ], 401);
        }

        $token = bin2hex(random_bytes(32));
        Cache::put(
            EnsureCvAdminSession::cacheKey($token),
            true,
            now()->addHours(8),
        );

        return response()->json([
            'token' => $token,
            'expires_in' => 28800,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $token = $request->bearerToken();

        if ($token) {
            Cache::forget(EnsureCvAdminSession::cacheKey($token));
        }

        return response()->json(['message' => 'Session administrateur fermée.']);
    }
}
