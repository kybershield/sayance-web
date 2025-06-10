import { style } from '@vanilla-extract/css';
import { color, config } from 'folds';

export const UserAvatar = style({
  backgroundColor: color.Secondary.Container,
  color: color.Secondary.OnContainer,
  textTransform: 'capitalize',
  borderRadius: '1000%',

  selectors: {
    '&[data-image-loaded="true"]': {
      backgroundColor: 'transparent',
    },
  },
});
