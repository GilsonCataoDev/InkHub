import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

interface GoogleProfile {
  id: string;
  displayName: string;
  emails: Array<{ value: string }>;
  photos: Array<{ value: string }>;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    const clientID = config.get<string>('GOOGLE_CLIENT_ID');
    super({
      clientID: clientID && clientID !== 'your_google_client_id' ? clientID : 'DISABLED',
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET') ?? 'DISABLED',
      callbackURL: config.get<string>('GOOGLE_CALLBACK_URL') ?? 'http://localhost:3001/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ) {
    const googleProfile = profile as unknown as GoogleProfile;
    const user = {
      googleId: googleProfile.id,
      email: googleProfile.emails[0]?.value,
      name: googleProfile.displayName,
      avatarUrl: googleProfile.photos[0]?.value,
    };
    done(null, user);
  }
}
