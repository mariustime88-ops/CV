<?php

namespace Database\Seeders;

use App\Models\CvProfile;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        CvProfile::query()->firstOrCreate(
            ['id' => 1],
            CvProfile::defaults(),
        );
    }
}
