import type { RegionCode } from '../../constants';
import { customFetch } from '../../utils/fetch';
import { APIError, handleAPIError } from '../../utils';
import { getStoryblokUrl } from '../../utils/api-routes';
import type { StoryblokLoginResponse, StoryblokLoginWithOtpResponse } from '../../types';
import { getUser } from '../user/actions';

export const loginWithToken = async (token: string, region: RegionCode) => {
  try {
    return await getUser(token, region);
  }
  catch (error) {
    // If getUser already threw an APIError, just re-throw it
    if (error instanceof APIError) {
      throw error;
    }

    handleAPIError('login_with_token', error);
  }
};

export const loginWithEmailAndPassword = async (email: string, password: string, region: RegionCode) => {
  try {
    // TODO: we cant use the getMapiClient for now here because token is required for its instantiation
    const url = getStoryblokUrl(region);
    return await customFetch<StoryblokLoginResponse>(`${url}/users/login`, {
      method: 'POST',
      body: { email, password },
    });
  }
  catch (error) {
    handleAPIError('login_email_password', error, 'The provided credentials are invalid');
  }
};

export const loginWithOtp = async (email: string, password: string, otp: string, region: RegionCode) => {
  try {
    const url = getStoryblokUrl(region);
    return await customFetch<StoryblokLoginWithOtpResponse>(`${url}/users/login`, {
      method: 'POST',
      body: { email, password, otp_attempt: otp },
    });
  }
  catch (error) {
    handleAPIError('login_with_otp', error as Error);
  }
};
