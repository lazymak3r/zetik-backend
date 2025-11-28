import { check } from 'k6';
import http from 'k6/http';
import { config } from './config.js';

export function login() {
  // Select random user for load testing
  const user = config.users[Math.floor(Math.random() * config.users.length)];

  const response = http.post(
    `${config.domain}/v1/auth/login/email`,
    JSON.stringify({
      email: user.login,
      password: user.password,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  const success = check(response, {
    'login successful': (r) => r.status === 200,
    'token received': (r) => r.json('accessToken') !== undefined,
  });

  if (success) {
    const body = response.json();
    return {
      token: body.accessToken,
      user: body.user,
    };
  }

  console.error('Login failed:', response.status, response.body);
  return null;
}
