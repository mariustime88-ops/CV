<?php

$frontendUrls = array_filter(array_map(
    'trim',
    explode(',', env('FRONTEND_URLS', 'http://localhost:4200')),
));

return [
    'paths' => ['api/*'],
    'allowed_methods' => ['GET', 'PUT', 'OPTIONS'],
    'allowed_origins' => $frontendUrls,
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['Content-Type', 'Authorization'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => false,
];
