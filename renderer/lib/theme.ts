import { createTheme } from '@mui/material/styles'
import darkScrollbar from '@mui/material/darkScrollbar'

export const theme = createTheme({
  palette: {
    mode: 'dark',
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: darkScrollbar(),
      },
    },
  },
})
