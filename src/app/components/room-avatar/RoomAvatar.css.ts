import { style } from '@vanilla-extract/css';
import { color } from 'folds';

export const RoomAvatar = style({
  backgroundColor: color.Secondary.Container,
  color: color.Secondary.OnContainer,
  textTransform: 'capitalize',
  borderRadius: '100%',

  selectors: {
    '&[data-image-loaded="true"]': {
      backgroundColor: 'transparent',
    },
  },
});
