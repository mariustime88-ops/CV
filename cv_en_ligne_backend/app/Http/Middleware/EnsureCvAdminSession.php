<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

class EnsureCvAdminSession
{
    public static function cacheKey(string $token): string
    {
        return 'cv_admin_session:'.hash('sha256', $token);
    }

    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (! $token || ! Cache::has(self::cacheKey($token))) {
            return response()->json([
                'message' => 'Connexion administrateur requise.',
            ], 401);
        }

        return $next($request);
    }
}
