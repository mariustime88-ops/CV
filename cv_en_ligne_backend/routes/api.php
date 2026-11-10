<?php

use App\Http\Controllers\Api\CvAdminController;
use App\Http\Controllers\Api\CvProfileController;
use App\Http\Middleware\EnsureCvAdminSession;
use Illuminate\Support\Facades\Route;

Route::get('/cv', [CvProfileController::class, 'show']);
Route::post('/admin/login', [CvAdminController::class, 'login'])
    ->middleware('throttle:5,1');
Route::delete('/admin/session', [CvAdminController::class, 'logout'])
    ->middleware(EnsureCvAdminSession::class);
Route::put('/cv', [CvProfileController::class, 'update'])
    ->middleware(EnsureCvAdminSession::class)
    ->middleware('throttle:10,1');
Route::post('/cv', [CvProfileController::class, 'update'])
    ->middleware(EnsureCvAdminSession::class)
    ->middleware('throttle:10,1');
