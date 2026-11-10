import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import { CvProfile } from './cv-profile';

@Injectable({ providedIn: 'root' })
export class CvApiService {
  constructor(private readonly http: HttpClient) {}

  load(): Observable<CvProfile> {
    return this.http.get<CvProfile>(`${environment.apiBaseUrl}/cv`);
  }

  login(password: string): Observable<{ token: string; expires_in: number }> {
    return this.http.post<{ token: string; expires_in: number }>(
      `${environment.apiBaseUrl}/admin/login`,
      { password },
    );
  }

  logout(token: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${environment.apiBaseUrl}/admin/session`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
  }

  save(profile: CvProfile, token: string, photo?: File): Observable<CvProfile> {
    if (photo) {
      const formData = new FormData();
      formData.append('profile_data', JSON.stringify(profile));
      formData.append('photo', photo);

      return this.http.post<CvProfile>(`${environment.apiBaseUrl}/cv`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    return this.http.put<CvProfile>(`${environment.apiBaseUrl}/cv`, profile, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}
