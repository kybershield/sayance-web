import React from 'react';
import { Box, Text } from 'folds';
import { PhoneLoginForm } from './PhoneLoginForm';

export function Login() {
  return (
    <Box direction="Column" gap="500">
      <Box direction="Column" gap="100">
        <Text size="H2" priority="400">
          Enter your phone number
        </Text>
        <Text size="T400" priority="300">
          We'll send you a verification code to your phone number.
        </Text>
      </Box>
      <PhoneLoginForm />
    </Box>
  );
}
