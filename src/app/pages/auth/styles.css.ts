import { style } from '@vanilla-extract/css';
import { DefaultReset, color, config, toRem } from 'folds';

export const AuthLayout = style({
  minHeight: '100vh',
  color: color.Background.OnContainer,
  position: 'relative',
});

export const AuthCard = style({
  marginTop: '1vh',
  maxWidth: toRem(460),
  width: '100%',
  backgroundColor: color.Surface.Container,
  color: color.Surface.OnContainer,
  // borderRadius: config.radii.R400,
  // boxShadow: config.shadow.E100,
  // border: `${config.borderWidth.B300} solid ${color.Surface.ContainerLine}`,
  overflow: 'hidden',
});

export const AuthLogo = style([
  DefaultReset,
  {
    width: toRem(26),
    height: toRem(26),

    borderRadius: '50%',
  },
]);

export const AuthHeader = style({
  padding: `0 ${config.space.S400}`,
  borderBottomWidth: config.borderWidth.B300,
});

export const AuthCardContent = style({
  // maxWidth: toRem(402),
  width: '100%',
  margin: 'auto',
  // padding: config.space.S400,
  // paddingTop: config.space.S700,
  // paddingBottom: toRem(44),
  // gap: toRem(44),
});

export const AuthFooter = style({
  padding: config.space.S200,
});

export const AuthSplitContainer = style({
  width: '100%',
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'stretch',
  gap: 0,
  '@media': {
    'screen and (max-width: 768px)': {
      flexDirection: 'column',
      gap: 0,
    },
  },
});

export const AuthLeftSide = style({
  flex: 1,
  backgroundColor: '#F4F6F9',
  paddingLeft: '4rem',
  paddingRight: '4rem',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '100vh',
});

export const AuthRightSide = style({
  flex: 1,
  backgroundColor: '#FFFFFF',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '100vh',
  padding: config.space.S400,
});

export const AuthImagePlaceholder = style({
  width: '100%',
  height: toRem(300),
  backgroundColor: '#000000',
  borderRadius: config.radii.R400,
  minHeight: toRem(200),
  maxWidth: toRem(400),
});
