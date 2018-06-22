import {Injectable, NgZone} from '@angular/core';
import {Storage} from '@ionic/storage';
import {Subject} from 'rxjs';
// Import AUTH_CONFIG, Auth0Cordova, and auth0.js
import {AUTH_CONFIG} from './auth.config';
import Auth0Cordova from '@auth0/cordova';
import * as auth0 from 'auth0-js';
import { AlertController } from 'ionic-angular';

@Injectable()
export class AuthService {
  Auth0 = new auth0.WebAuth(AUTH_CONFIG);
  Client = new Auth0Cordova(AUTH_CONFIG);
  accessToken: string;
  user: any;
  loggedIn: boolean;
  loading = true;
  isLoggedIn$ = new Subject();

  constructor(public zone: NgZone, private storage: Storage, private alertCtrl: AlertController) {
    this.storage.get('profile').then(user => (this.user = user));
    this.storage.get('access_token').then(token => (this.accessToken = token));
    this.storage.get('expires_at').then(exp => {
      this.loggedIn = Date.now() < JSON.parse(exp);
      this.loading = false;
      this.isLoggedIn$.next(this.loggedIn);
    });
  }

  login() {
    return new Promise((resolve, reject) => {
      this.loading = true;
      const options = {
        scope: 'openid profile offline_access',
      };
      // Authorize login request with Auth0: open login page and get auth results
      this.Client.authorize(options, (err, authResult) => {
        if (err) {
          let alert = this.alertCtrl.create({
            title: 'Low battery',
            subTitle: JSON.stringify(err.original),
            buttons: ['Dismiss']
          });
          alert.present();

          this.loading = false;
          reject(err);
        } else {
          // Set access token & id token
          this.storage.set('id_token', authResult.idToken);
          this.storage.set('access_token', authResult.accessToken)
            .then(() => {
              // Set logged in
              this.loading = false;
              this.loggedIn = true;
              this.isLoggedIn$.next(this.loggedIn);
              resolve();
            });
          this.accessToken = authResult.accessToken;
          // Set access token expiration
          const expiresAt = JSON.stringify(
            authResult.expiresIn * 1000 + new Date().getTime()
          );
          this.storage.set('expires_at', expiresAt);
          // Fetch user's profile info
          this.Auth0.client.userInfo(this.accessToken, (err, profile) => {
            if (err) {
              throw err;
            }
            this.storage
              .set('profile', profile)
              .then(val => this.zone.run(() => (this.user = profile)));
          });
        }
      });
    });
  }

  logout() {
    this.storage.remove('profile');
    this.storage.remove('access_token');
    this.storage.remove('expires_at');
    this.storage.remove('id_token');
    this.accessToken = null;
    this.user = {};
    this.loggedIn = false;
    this.isLoggedIn$.next(this.loggedIn);
  }
}
