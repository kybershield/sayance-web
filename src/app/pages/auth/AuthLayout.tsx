import React, { useCallback, useEffect } from 'react';
import { Box, Header, Scroll, Spinner, Text } from 'folds';
import { Outlet } from 'react-router-dom';
import classNames from 'classnames';

import { AuthFooter } from './AuthFooter';
import * as css from './styles.css';
import * as PatternsCss from '../../styles/Patterns.css';
import { AutoDiscoveryAction, autoDiscovery } from '../../cs-api';
import { SpecVersionsLoader } from '../../components/SpecVersionsLoader';
import { SpecVersionsProvider } from '../../hooks/useSpecVersions';
import { AutoDiscoveryInfoProvider } from '../../hooks/useAutoDiscoveryInfo';
import { AuthFlowsLoader } from '../../components/AuthFlowsLoader';
import { AuthFlowsProvider } from '../../hooks/useAuthFlows';
import { AuthServerProvider } from '../../hooks/useAuthServer';
import { AsyncStatus, useAsyncCallback } from '../../hooks/useAsyncCallback';
import { BASE_URL } from '../../../util/constants';
// import CinnySVG from '../../../../public/res/svg/cinny.svg';
import Banner from '../../../../public/images/sign-up/banner.png';
import SayanceLogo from '../../../../public/logo.svg';

function AuthLayoutLoading({ message }: { message: string }) {
  return (
    <Box justifyContent="Center" alignItems="Center" gap="200">
      <Spinner size="100" variant="Secondary" />
      <Text align="Center" size="T300">
        {message}
      </Text>
    </Box>
  );
}

function AuthLayoutError({ message }: { message: string }) {
  return (
    <Box justifyContent="Center" alignItems="Center" gap="200">
      <Text align="Center" style={{ color: 'red' }} size="T300">
        {message}
      </Text>
    </Box>
  );
}

export function AuthLayout() {
  const server = BASE_URL;

  const [discoveryState, discoverServer] = useAsyncCallback(
    useCallback(async (serverName: string) => {
      const response = await autoDiscovery(fetch, serverName);
      return {
        serverName,
        response,
      };
    }, [])
  );

  useEffect(() => {
    discoverServer(server);
  }, [discoverServer, server]);

  const [autoDiscoveryError, autoDiscoveryInfo] =
    discoveryState.status === AsyncStatus.Success ? discoveryState.data.response : [];

  return (
    <Scroll variant="Background" visibility="Hover" size="300" hideTrack>
      <Box
        className={classNames(css.AuthLayout)}
        // className={classNames(css.AuthLayout, PatternsCss.BackgroundDotPattern)}
        direction="Column"
      >
        {/* Split Layout Container */}
        <Box className={css.AuthSplitContainer} direction="Row">
          {/* Left Side - Marketing Content */}
          <Box className={css.AuthLeftSide} direction="Column" gap="500">
            <Box direction="Column" gap="400">
              <Box direction="Row" gap="200" alignItems="Center">
                <img src={SayanceLogo} alt="Sayance Logo" style={{ width: '40px' }} />
                <Text size="H4" priority="400">
                  Sayance.io
                </Text>
              </Box>

              <Text size="H1" priority="400">
                Private Conversations, <br /> Made Simple.
              </Text>
              <Text size="T400" priority="300" style={{ lineHeight: '1.6' }}>
                Sayance is your secure space to enjoy fast, private messaging and calls, with
                end-to-end encryption. No data mining or tracking — just privacy by design.
              </Text>
            </Box>
            {/* Image Placeholder */}
            <img
              src={Banner}
              style={{ width: '100%', aspectRatio: '1/0.8', objectFit: 'cover' }}
              alt="Sayance banner"
              loading="lazy"
            />
          </Box>

          {/* Right Side - Login Form */}
          <Box className={css.AuthRightSide} direction="Column">
            <Box direction="Column" style={{ width: '100%', maxWidth: '460px' }}>
              <Box direction="Column" className={css.AuthCard}>
                <Box className={css.AuthCardContent} direction="Column">
                  {discoveryState.status === AsyncStatus.Loading && (
                    <AuthLayoutLoading message="Connecting to server..." />
                  )}
                  {discoveryState.status === AsyncStatus.Error && (
                    <AuthLayoutError message="Failed to connect to server." />
                  )}
                  {autoDiscoveryError?.action === AutoDiscoveryAction.FAIL_PROMPT && (
                    <AuthLayoutError
                      message={`Failed to connect. Homeserver configuration found with ${autoDiscoveryError.host} appears unusable.`}
                    />
                  )}
                  {autoDiscoveryError?.action === AutoDiscoveryAction.FAIL_ERROR && (
                    <AuthLayoutError message="Failed to connect. Homeserver configuration base_url appears invalid." />
                  )}
                  {discoveryState.status === AsyncStatus.Success && autoDiscoveryInfo && (
                    <AuthServerProvider value={discoveryState.data.serverName}>
                      <AutoDiscoveryInfoProvider value={autoDiscoveryInfo}>
                        <SpecVersionsLoader
                          baseUrl={BASE_URL}
                          fallback={() => (
                            <AuthLayoutLoading message={`Connecting to ${BASE_URL}`} />
                          )}
                          error={() => (
                            <AuthLayoutError message="Failed to connect. Either server is unavailable at this moment or does not exist." />
                          )}
                        >
                          {(specVersions) => (
                            <SpecVersionsProvider value={specVersions}>
                              <AuthFlowsLoader
                                fallback={() => (
                                  <AuthLayoutLoading message="Loading authentication flow..." />
                                )}
                                error={() => (
                                  <AuthLayoutError message="Failed to get authentication flow information." />
                                )}
                              >
                                {(authFlows) => (
                                  <AuthFlowsProvider value={authFlows}>
                                    <Outlet />
                                  </AuthFlowsProvider>
                                )}
                              </AuthFlowsLoader>
                            </SpecVersionsProvider>
                          )}
                        </SpecVersionsLoader>
                      </AutoDiscoveryInfoProvider>
                    </AuthServerProvider>
                  )}
                </Box>
              </Box>

              {/* Footer positioned at bottom of right side */}
              {/* <Box style={{ marginTop: 'auto', paddingTop: '2rem' }}>
                <AuthFooter />
              </Box> */}
            </Box>
          </Box>
        </Box>
      </Box>
    </Scroll>
  );
}
