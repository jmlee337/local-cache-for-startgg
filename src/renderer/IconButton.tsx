import {
  IconButton as IconButtonBase,
  IconButtonProps,
  styled,
} from '@mui/material';

const IconButton = styled(IconButtonBase)<IconButtonProps>(({ theme }) => ({
  color: theme.palette.primary.main,
}));
export default IconButton;
