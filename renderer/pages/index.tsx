import React from 'react'
import Head from 'next/head'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import Select from '@mui/material/Select'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import TextField from '@mui/material/TextField'
import AdapterDateFns from '@mui/lab/AdapterDateFns'
import LocalizationProvider from '@mui/lab/LocalizationProvider'
import DateTimePicker from '@mui/lab/DateTimePicker'
import ukLocale from 'date-fns/locale/uk'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import LinearProgress from '@mui/material/LinearProgress'
import Stepper from '@mui/material/Stepper'
import Step from '@mui/material/Step'
import StepLabel from '@mui/material/StepLabel'
import ErrorIcon from '@mui/icons-material/Error'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import FilterListIcon from '@mui/icons-material/FilterList'
import Menu from '@mui/material/Menu'
import IconButton from '@mui/material/IconButton'
import Badge from '@mui/material/Badge'
import SettingsIcon from '@mui/icons-material/Settings'
import { pink, green, red, yellow } from '@mui/material/colors'
import { ipcRenderer } from 'electron'

type sett =
  | 'trix'
  | 'sma'
  | 'upper'
  | 'lower'
  | 'candle'
  | 'tp'
  | 'sl'
  | 'tsl'
  | 'leverage'
  | 'wallet'
  | 'walletLimit'

declare global {
  interface ObjectConstructor {
    keys<T>(o: T): Array<keyof T>
  }
}

export type State = {
  pair: string
  start: number
  end: number
  strategy: string
  history: string
  sett: { [x in sett]: number }
  errors?: { [x in sett]?: boolean }
  loading: boolean
  loadingText?: string
  steps?: string[]
  step?: number
  progress?: number
  result?: any
  error?: string
  all?: number
  dataStart?: number
  dataEnd?: number
  startWork?: number
  anchor?: HTMLElement
  filter?: 'profit' | 'loss'
}

const translate = {
  trix: 'TRIX',
  sma: 'SMA',
  upper: 'Верхня межа',
  lower: 'Нижня межа',
  candle: 'Період свічки',
  tp: 'Тейк профіт',
  sl: 'Стоп лосс',
  tsl: 'Динамічний стоп лосс',
  leverage: 'Плече',
  wallet: 'Гаманець',
  walletLimit: 'Ліміт гаманця',
}

class Index extends React.Component<{}, State> {
  private pairs: string[]
  private histories: string[]
  private math: {
    round: (num: number, precision?: number, down?: boolean) => number
  }
  private time: {
    format: (time: number) => string
  }
  constructor({}) {
    super({})
    this.pairs = [
      'ADAUSDT',
      'BNBUSDT',
      'BNBBUSD',
      'BTCUSDT',
      'BTCBUSD',
      'DOGEUSDT',
      'DOGEBUSD',
      'DOTUSDT',
      'ETHBUSD',
      'ETHUSDT',
      'SOLUSDT',
      'XRPUSDT',
    ]
    this.histories = ['2c', '3c']
    this.state = {
      pair: 'ADAUSDT',
      start: new Date().getTime() - 24 * 60 * 60 * 1000,
      end: new Date().getTime(),
      strategy: 'trix',
      history: '3c',
      sett: {
        trix: 2,
        sma: 21,
        upper: 0.259,
        lower: -0.413,
        candle: 165,
        tp: 0,
        sl: 95,
        tsl: 25,
        leverage: 20,
        wallet: 15,
        walletLimit: 0,
      },
      loading: false,
      steps: [
        'Шукаємо дані про угоди',
        'Завантаження архівних даних',
        'Розпаковуємо дані',
        'Завантаження по API',
        'Перевірка данних',
        'Симуляція',
        'Результат',
      ],
      step: 0,
    }
    this.math = {
      round: (num: number, precision = 2, down = false) => {
        if (down) {
          return Number(
            Math.floor(Number(num + 'e' + precision)) + 'e-' + precision
          )
        }
        return Number(
          Math.round(Number(num + 'e' + precision)) + 'e-' + precision
        )
      },
    }
    this.time = {
      format: (time: number) => {
        return new Intl.DateTimeFormat('uk', {
          day: 'numeric',
          month: 'short',
          hour: 'numeric',
          minute: 'numeric',
          second: 'numeric',
          timeZone: 'Europe/Kiev',
        }).format(new Date(time))
      },
    }
    this.handleChangeSelect = this.handleChangeSelect.bind(this)
    this.handleChangeDate = this.handleChangeDate.bind(this)
    this.handleChangeText = this.handleChangeText.bind(this)
    this.closeDialog = this.closeDialog.bind(this)
    this.startLoading = this.startLoading.bind(this)
    this.saveData = this.saveData.bind(this)
    this.openMenu = this.openMenu.bind(this)
    this.closeMenu = this.closeMenu.bind(this)
    this.setFilter = this.setFilter.bind(this)
  }
  componentDidMount() {
    ipcRenderer.on(
      'loaderEvent',
      (_e, data: { text: string; step: number; progress?: number }) =>
        this.setState((prev) => ({
          ...prev,
          loadingText: data.text,
          step: data.step,
          progress: data.progress,
        }))
    )
    ipcRenderer.on(
      'result',
      (
        _e,
        data: {
          data: State['result']
          start: number
          end: number
          all: number
          startWork: number
        }
      ) =>
        this.setState((prev) => ({
          ...prev,
          result: data.data,
          step: 6,
          all: data.all,
          dataStart: data.start,
          dataEnd: data.end,
          startWork: data.startWork,
        }))
    )
    ipcRenderer.on('error', (_e, error: string) =>
      this.setState((prev) => ({ ...prev, error }))
    )
    const storeData = ipcRenderer.sendSync('get-store-data') as
      | State
      | undefined
    if (storeData) {
      this.setState(() => ({ ...storeData }))
    } else {
      this.saveData()
    }
  }
  saveData() {
    const toSave = { ...this.state }
    delete toSave.loadingText
    delete toSave.step
    delete toSave.steps
    delete toSave.progress
    delete toSave.result
    delete toSave.error
    delete toSave.all
    delete toSave.dataStart
    delete toSave.dataEnd
    delete toSave.startWork
    delete toSave.anchor
    delete toSave.filter
    ipcRenderer.send('store-data', { ...toSave })
  }
  handleChangeSelect(select: 'history' | 'pair', value: string) {
    this.setState((prev) => ({ ...prev, [select]: value }), this.saveData)
  }
  handleChangeDate(type: 'start' | 'end', value: number | null) {
    if (value) {
      this.setState(
        (prev) => ({ ...prev, [type]: new Date(value).getTime() }),
        this.saveData
      )
    }
  }
  handleChangeText(field: keyof State['sett'], value: string) {
    this.setState(
      (prev) => ({
        ...prev,
        sett: {
          ...prev.sett,
          [field]: value,
        },
        errors: {
          ...prev.errors,
          [field]: false,
        },
      }),
      this.saveData
    )
  }
  openMenu(event: React.MouseEvent<HTMLElement>) {
    //@ts-ignore
    this.setState((prev) => ({ ...prev, anchor: event.target }))
  }
  closeMenu() {
    this.setState((prev) => ({ ...prev, anchor: undefined }))
  }
  closeDialog() {
    ipcRenderer.send('cancel')
    this.setState((prev) => ({
      ...prev,
      loading: false,
    }))
  }
  startLoading() {
    const sett = { ...this.state.sett }
    let send = true
    Object.keys(sett).map((item) => {
      if (isNaN(parseFloat(`${sett[item]}`))) {
        send = false
        //@ts-ignore
        this.setState((prev) => {
          const st = prev
          if (st.errors) {
            return {
              ...prev,
              errors: { ...prev.errors, [item]: true },
            }
          } else {
            return {
              ...prev,
              errors: { [item]: true },
            }
          }
        })
      }
      sett[item] = parseFloat(`${sett[item]}`)
    })
    if (send) {
      ipcRenderer.send('data', { ...this.state, sett })
      this.setState((prev) => ({
        ...prev,
        loading: true,
        step: 0,
        loadingText: '',
        result: undefined,
        error: undefined,
        dataStart: undefined,
        dataEnd: undefined,
        startWork: undefined,
        progress: undefined,
        filter: undefined,
        anchor: undefined,
      }))
    }
  }
  setFilter(filter?: 'profit' | 'loss') {
    this.setState((prev) => ({ ...prev, filter, anchor: undefined }))
  }
  openDialogDir() {
    ipcRenderer.send('dirDialog')
  }
  render() {
    const {
      state: {
        pair,
        start,
        end,
        strategy,
        history,
        sett,
        loading,
        loadingText,
        steps,
        step,
        progress,
        result,
        error,
        all,
        errors,
        dataStart,
        dataEnd,
        sett: { wallet },
        startWork,
        anchor,
        filter,
      },
      handleChangeSelect,
      handleChangeDate,
      handleChangeText,
      closeDialog,
      startLoading,
      closeMenu,
      openMenu,
      setFilter,
      openDialogDir,
      pairs,
      histories,
      time,
      math,
    } = this
    let probProfit = 0
    let avgProfit = 0
    let avgLoss = 0
    let probLoss = 0
    if (result) {
      probProfit =
        math.round((result.profit.buy + result.profit.sell) / result.all, 2) ||
        0
      avgProfit =
        math.round(
          result.profit.amount / (result.profit.buy + result.profit.sell)
        ) || 0
      avgLoss =
        -math.round(
          result.loss.amount / (result.loss.buy + result.loss.sell)
        ) || 0
      probLoss = result.all > 0 ? math.round(1 - probProfit, 2) || 0 : 0
    }
    return (
      <>
        <Head>
          <title>MT Симуляції</title>
        </Head>
        <Dialog
          open={loading}
          aria-labelledby='alert-dialog-title'
          aria-describedby='alert-dialog-description'
          fullScreen
        >
          <DialogTitle id='alert-dialog-title'>Симуляція в процесі</DialogTitle>
          <DialogContent dividers>
            {error ? (
              <DialogContentText
                id='alert-dialog-description'
                sx={{
                  width: '100%',
                  marginTop: 3,
                  color: 'text.primary',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <ErrorIcon sx={{ fontSize: 60, color: pink[500] }} />
                {error}
              </DialogContentText>
            ) : (
              <>
                <Stepper activeStep={step} alternativeLabel>
                  {steps &&
                    steps.map((label) => (
                      <Step key={label}>
                        <StepLabel>{label}</StepLabel>
                      </Step>
                    ))}
                </Stepper>
                {result ? (
                  <>
                    <Box
                      sx={{
                        width: '100%',
                        marginTop: 3,
                        display: 'flex',
                      }}
                    >
                      <Card
                        sx={{ maxWidth: '50%', flexGrow: 1, marginRight: 2 }}
                      >
                        <CardHeader
                          title='Результат'
                          subheader={`Проведено з${' '}
                    ${time.format(dataStart ? dataStart : start)} по${' '}
                    ${time.format(dataEnd ? dataEnd : end)} на основі${' '}
                    ${(all || 0).toLocaleString()} угод`}
                        />
                        <CardContent>
                          Профіт:{' '}
                          <Typography
                            sx={{
                              color: result.net > 0 ? green[500] : red[500],
                              display: 'inline-block',
                            }}
                          >
                            {result.net.toLocaleString()} $
                          </Typography>{' '}
                          з {wallet} $
                          <br />
                          Максимальне падіння:{' '}
                          <Typography
                            sx={{
                              color:
                                result.fall >= 0.8 && result.fall < 1
                                  ? red[500]
                                  : result.fall >= 0.45 && result.fall < 0.8
                                  ? yellow[500]
                                  : green[500],
                              display: 'inline-block',
                            }}
                          >
                            {math.round(result.fall * 100, 0)}%
                          </Typography>
                          <br />
                          Очікування:{' '}
                          <Typography
                            sx={{
                              color:
                                probProfit * avgProfit - probLoss * avgLoss > 0
                                  ? green[500]
                                  : red[500],
                              display: 'inline-block',
                            }}
                          >
                            {(
                              math.round(
                                probProfit * avgProfit - probLoss * avgLoss
                              ) || 0
                            ).toLocaleString()}{' '}
                            $
                          </Typography>
                          <br />
                          Позицій: {result.all.toLocaleString()}
                          <br />
                          Прибуткових позицій:{' '}
                          {result.profit.buy + result.profit.sell} (продажа -{' '}
                          {result.profit.sell}, покупка - {result.profit.buy})
                          <br />
                          Збиткових позицій:{' '}
                          {result.loss.buy + result.loss.sell} (продажа -{' '}
                          {result.loss.sell}, покупка - {result.loss.buy})
                          <br />
                          Загальний профіт:{' '}
                          {result.profit.amount.toLocaleString()} $ (продажа -{' '}
                          {result.profit.sellAmount.toLocaleString()} $, покупка
                          - {result.profit.buyAmount.toLocaleString()} $)
                          <br />
                          Загальний збиток:{' '}
                          {result.loss.amount.toLocaleString()} $ (продажа -{' '}
                          {result.loss.sellAmount.toLocaleString()} $, покупка -{' '}
                          {result.loss.buyAmount.toLocaleString()} $)
                          <br />
                          Вирогідність профіту:{' '}
                          {math.round(probProfit * 100, 0)}%
                          <br />
                          Середній профіт: {avgProfit.toLocaleString()} $
                          <br />
                          Середній збиток: {avgLoss.toLocaleString()} $
                          <br />
                          Точність лонгів:{' '}
                          {math.round(
                            (result.profit.buy /
                              (result.profit.buy + result.loss.buy)) *
                              100,
                            0
                          ) || 0}
                          %<br />
                          Точність шортів:{' '}
                          {math.round(
                            (result.profit.sell /
                              (result.profit.sell + result.loss.sell)) *
                              100,
                            0
                          ) || 0}
                          %
                        </CardContent>
                      </Card>
                      <Card
                        sx={{
                          maxWidth: '50%',
                          flexGrow: 1,
                          marginRight: 2,
                          maxHeight: '500px',
                          overflowY: 'auto',
                        }}
                      >
                        <CardHeader
                          title='Позиції'
                          action={
                            <IconButton onClick={openMenu}>
                              <Badge
                                color='secondary'
                                variant='dot'
                                invisible={!Boolean(filter)}
                              >
                                <FilterListIcon />
                              </Badge>
                            </IconButton>
                          }
                        />
                        <Menu
                          anchorEl={anchor}
                          open={Boolean(anchor)}
                          onClose={closeMenu}
                          anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'right',
                          }}
                          transformOrigin={{
                            vertical: 'top',
                            horizontal: 'right',
                          }}
                        >
                          <MenuItem
                            onClick={() => setFilter()}
                            selected={!Boolean(filter)}
                          >
                            Всі
                          </MenuItem>
                          <MenuItem
                            onClick={() => setFilter('profit')}
                            sx={{ color: green[500] }}
                            selected={filter === 'profit'}
                          >
                            Прибуткові
                          </MenuItem>
                          <MenuItem
                            onClick={() => setFilter('loss')}
                            sx={{ color: red[500] }}
                            selected={filter === 'loss'}
                          >
                            Збиткові
                          </MenuItem>
                        </Menu>
                        <CardContent>
                          {result.hist &&
                            result.hist.length > 0 &&
                            result.hist
                              .filter((pos: any) => {
                                if (filter) {
                                  if (filter === 'profit') {
                                    return pos.net > 0
                                  }
                                  if (filter === 'loss') {
                                    return pos.net <= 0
                                  }
                                }
                                return true
                              })
                              .map((pos: any) => (
                                <Card
                                  key={pos.id}
                                  raised
                                  sx={{ marginBottom: 2 }}
                                >
                                  <CardContent>
                                    Сторона:{' '}
                                    {pos.type === 'SELL'
                                      ? 'продажа'
                                      : 'покупка'}
                                    <br />
                                    Ціна відкриття: {pos.price.toLocaleString()}
                                    <br />
                                    Ціна закриття:{' '}
                                    {pos.closePrice.toLocaleString()}
                                    <br />
                                    Вартість позиції:{' '}
                                    {pos.cost.toLocaleString()} $
                                    <br />
                                    Кількість: {pos.amount.toLocaleString()}
                                    <br />
                                    Час відкриття: {pos.humanTime}
                                    <br />
                                    Час закриття: {pos.humanCloseTime}
                                    <br />
                                    Прибуток:{' '}
                                    <Typography
                                      sx={{
                                        color:
                                          pos.net > 0 ? green[500] : red[500],
                                        display: 'inline-block',
                                      }}
                                    >
                                      {pos.net.toLocaleString()} $
                                    </Typography>
                                  </CardContent>
                                </Card>
                              ))}
                        </CardContent>
                      </Card>
                    </Box>
                    <Typography sx={{ marginTop: 2 }}>
                      Старт виконання тесту: {time.format(startWork || start)}
                      <br /> Кінець виконання тесту:{' '}
                      {time.format(new Date().getTime())}{' '}
                    </Typography>
                  </>
                ) : (
                  <>
                    <DialogContentText
                      id='alert-dialog-description'
                      sx={{
                        width: '100%',
                        marginTop: 3,
                        color: 'text.primary',
                      }}
                    >
                      {loadingText ? (
                        <div
                          dangerouslySetInnerHTML={{ __html: loadingText }}
                        />
                      ) : (
                        'Підготовка...'
                      )}
                    </DialogContentText>
                    <LinearProgress
                      color='secondary'
                      value={progress}
                      variant={progress ? 'determinate' : 'indeterminate'}
                    />
                  </>
                )}
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDialog}>Закрити</Button>
          </DialogActions>
        </Dialog>
        <AppBar position='static'>
          <Toolbar>
            <Typography
              variant='subtitle1'
              component='div'
              sx={{ flexGrow: 1 }}
            >
              Симуляція бота на заданому проміжку часу
            </Typography>
            <IconButton onClick={openDialogDir}>
              <SettingsIcon></SettingsIcon>
            </IconButton>
          </Toolbar>
        </AppBar>
        <Box
          sx={{
            width: '100%',
            padding: 2,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <FormControl sx={{ width: 200 }}>
            <InputLabel id='pair'>Пара</InputLabel>
            <Select
              labelId='pair'
              id='pair-select'
              value={pair}
              label='пара'
              onChange={(e) => handleChangeSelect('pair', e.target.value)}
            >
              {pairs.map((item) => (
                <MenuItem key={item} value={item}>
                  {item}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <LocalizationProvider dateAdapter={AdapterDateFns} locale={ukLocale}>
            <Box sx={{ display: 'flex', width: 600 }}>
              <DateTimePicker
                renderInput={(props) => (
                  <TextField {...props} sx={{ marginTop: 2, marginRight: 2 }} />
                )}
                label='Початок періоду'
                value={start}
                onChange={(newValue) => {
                  handleChangeDate('start', newValue)
                }}
                maxDate={end}
                minDate={new Date().getTime() - 6 * 30 * 24 * 60 * 60 * 1000}
                mask='__.__.____ __:__'
              />
              <DateTimePicker
                renderInput={(props) => (
                  <TextField {...props} sx={{ marginTop: 2 }} />
                )}
                label='Кінець періоду'
                value={end}
                onChange={(newValue) => {
                  handleChangeDate('end', newValue)
                }}
                maxDate={new Date().getTime()}
                minDate={start}
                mask='__.__.____ __:__'
              />
            </Box>
          </LocalizationProvider>
          <Box>
            <FormControl sx={{ width: 200, marginTop: 2, marginRight: 2 }}>
              <InputLabel id='strategy'>Стратегія</InputLabel>
              <Select
                labelId='strategy'
                id='startegy-select'
                value={strategy}
                label='стратегія'
                disabled
              >
                <MenuItem value={strategy}>TRIX</MenuItem>
              </Select>
            </FormControl>
            <FormControl sx={{ width: 200, marginTop: 2 }}>
              <InputLabel id='history'>Вікно історії</InputLabel>
              <Select
                labelId='history'
                id='history-select'
                value={history}
                label='вікно історії'
                onChange={(e) => handleChangeSelect('history', e.target.value)}
              >
                {histories.map((item, ind) => (
                  <MenuItem key={`${item}-${ind}`} value={item}>
                    {item === '2c' ? 'Через 2 свічки' : 'Через 3 свічки'}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Grid container spacing={2} sx={{ marginTop: 2, maxWidth: 912 }}>
            {Object.keys(sett).map((item, ind) => (
              <Grid
                item
                lg={3}
                md={3}
                sm={3}
                sx={{ width: 216 }}
                key={`${item}-${ind}`}
              >
                <TextField
                  label={translate[item]}
                  value={sett[item]}
                  error={errors && errors[item]}
                  //@ts-ignore
                  onChange={(e) => handleChangeText(item, e.target.value)}
                />
              </Grid>
            ))}
          </Grid>
          <Button
            variant='contained'
            type='submit'
            sx={{ width: 200, marginTop: 2, height: 48 }}
            onClick={startLoading}
          >
            Старт
          </Button>
        </Box>
      </>
    )
  }
}

export default Index
