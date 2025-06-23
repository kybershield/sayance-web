import React from 'react';
import { Box, config } from 'folds';
import { Page, PageHero, PageHeroSection } from '../../components/page';
import SayanceLogo from '../../../../public/logo.svg';

export function WelcomePage() {
  return (
    <Page>
      <Box
        grow="Yes"
        style={{ padding: config.space.S400, paddingBottom: config.space.S700 }}
        alignItems="Center"
        justifyContent="Center"
      >
        <PageHeroSection>
          <PageHero
            icon={<img width="70" height="70" src={SayanceLogo} alt="Sayance Logo" />}
            title="Welcome to Sayance"
            subTitle={<span>End to end encrypted messaging application.</span>}
          ></PageHero>
        </PageHeroSection>
      </Box>
    </Page>
  );
}
