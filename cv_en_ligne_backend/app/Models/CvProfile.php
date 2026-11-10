<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CvProfile extends Model
{
    protected $fillable = [
        'name',
        'title',
        'profile',
        'email',
        'phone',
        'location',
        'website',
        'photo_url',
        'languages',
        'skills',
        'hobbies',
        'education',
        'experience',
        'achievements',
    ];

    protected function casts(): array
    {
        return [
            'languages' => 'array',
            'skills' => 'array',
            'hobbies' => 'array',
            'education' => 'array',
            'experience' => 'array',
            'achievements' => 'array',
        ];
    }

    public static function defaults(): array
    {
        return [
            'name' => 'Votre nom',
            'title' => 'Votre métier',
            'profile' => 'Ajoutez ici une courte présentation de votre parcours et de vos objectifs professionnels.',
            'email' => 'votre.email@exemple.com',
            'phone' => '',
            'location' => 'Votre ville',
            'website' => '',
            'photo_url' => '',
            'languages' => [],
            'skills' => [],
            'hobbies' => [],
            'education' => [],
            'experience' => [],
            'achievements' => [],
        ];
    }
}
