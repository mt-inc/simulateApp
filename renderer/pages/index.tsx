import React from 'react';
import Head from 'next/head';
import { Time, Math as MathHelper } from '@mt-inc/utils/dist/cjs/index';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import TextField from '@mui/material/TextField';
import AdapterDateFns from '@mui/lab/AdapterDateFns';
import LocalizationProvider from '@mui/lab/LocalizationProvider';
import DateTimePicker from '@mui/lab/DateTimePicker';
import ukLocale from 'date-fns/locale/uk';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import LinearProgress from '@mui/material/LinearProgress';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import ErrorIcon from '@mui/icons-material/Error';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import FilterListIcon from '@mui/icons-material/FilterList';
import Menu from '@mui/material/Menu';
import IconButton from '@mui/material/IconButton';
import Badge from '@mui/material/Badge';
import SettingsIcon from '@mui/icons-material/Settings';
import { pink, green, red, yellow, grey } from '@mui/material/colors';
import { ipcRenderer } from 'electron';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import dynamic from 'next/dynamic';
import ua from 'apexcharts/dist/locales/ua.json';
import type { ApexOptions } from 'apexcharts';
interface Props {
  type?:
    | 'line'
    | 'area'
    | 'bar'
    | 'histogram'
    | 'pie'
    | 'donut'
    | 'radialBar'
    | 'scatter'
    | 'bubble'
    | 'heatmap'
    | 'treemap'
    | 'boxPlot'
    | 'candlestick'
    | 'radar'
    | 'polarArea'
    | 'rangeBar';
  series?: Array<any>;
  width?: string | number;
  height?: string | number;
  options?: ApexOptions;
  [key: string]: any;
}

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
  | 'maLow'
  | 'maHigh'
  | 'trs'
  | 'ampTrs'
  | 'rsi'
  | 'rsiHigh'
  | 'rsiLow';

declare global {
  interface ObjectConstructor {
    keys<T>(o: T): Array<keyof T>;
  }
}

export type State = {
  pair: string;
  start: number;
  end: number;
  strategy: string;
  history: string;
  sett: { [x in sett]: number };
  errors?: { [x in sett]?: boolean };
  loading: boolean;
  loadingText?: string;
  steps?: string[];
  step?: number;
  progress?: number;
  result?: any;
  error?: string;
  all?: number;
  dataStart?: number;
  dataEnd?: number;
  startWork?: number;
  anchor?: HTMLElement;
  filter?: 'profit' | 'loss';
  candles?: number[][];
  endTest?: number;
  usePlot?: boolean;
  chartMin?: number;
  chartMax?: number;
  indicators?: {
    trix?: number[];
    sma?: number[];
  };
};

const translate = {
  trix: 'TRIX',
  ema: 'EMA',
  'ema+rsi': 'EMA+RSI',
  sma: 'SMA',
  'sma+rsi': 'SMA+RSI',
  upper: 'Верхня межа',
  lower: 'Нижня межа',
  candle: 'Період свічки',
  tp: 'Тейк профіт',
  sl: 'Стоп лосс',
  tsl: 'Динамічний стоп лосс',
  leverage: 'Плече',
  wallet: 'Гаманець',
  walletLimit: 'Ліміт гаманця',
  maLow: 'MA низька',
  maHigh: 'МА висока',
  trs: 'Поріг',
  ampTrs: 'Амплітуда свічки',
  rsi: 'Період RSI',
  rsiHigh: 'Верхній RSI',
  rsiLow: 'Нижній RSI',
};

class Index extends React.Component<{}, State> {
  private pairs: string[];
  private histories: string[];
  private math: MathHelper;
  private time: Time;
  private strategies: string[];
  private visible: {
    strategy: string;
    fields: string[];
  }[];
  private commonFileds: string[];
  private Chart?: React.ComponentType<Props>;
  constructor({}) {
    super({});
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
    ];
    this.strategies = ['trix', 'ema+rsi', 'ema', 'sma+rsi', 'sma'];
    this.histories = ['2c', '3c'];
    this.state = {
      pair: 'ADAUSDT',
      start: new Date().getTime() - 24 * 60 * 60 * 1000,
      end: new Date().getTime(),
      strategy: 'trix',
      history: '3c',
      sett: {
        maLow: 6,
        maHigh: 19,
        trs: 0.03,
        rsi: 7,
        rsiHigh: 50,
        rsiLow: 50,
        ampTrs: 0,
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
    };
    this.math = new MathHelper();
    this.time = new Time();
    this.handleChangeSelect = this.handleChangeSelect.bind(this);
    this.handleChangeDate = this.handleChangeDate.bind(this);
    this.handleChangeText = this.handleChangeText.bind(this);
    this.handleChangeSwitch = this.handleChangeSwitch.bind(this);
    this.closeDialog = this.closeDialog.bind(this);
    this.startLoading = this.startLoading.bind(this);
    this.saveData = this.saveData.bind(this);
    this.openMenu = this.openMenu.bind(this);
    this.closeMenu = this.closeMenu.bind(this);
    this.setFilter = this.setFilter.bind(this);
    this.showResult = this.showResult.bind(this);
    this.updateChartData = this.updateChartData.bind(this);
    this.visible = [
      {
        strategy: 'trix',
        fields: ['trix', 'sma', 'upper', 'lower'],
      },
      {
        strategy: 'ema',
        fields: ['maLow', 'maHigh', 'trs', 'ampTrs'],
      },
      {
        strategy: 'sma',
        fields: ['maLow', 'maHigh', 'trs', 'ampTrs'],
      },
      {
        strategy: 'sma+rsi',
        fields: ['maLow', 'maHigh', 'trs', 'ampTrs', 'rsi', 'rsiHigh', 'rsiLow'],
      },
      {
        strategy: 'ema+rsi',
        fields: ['maLow', 'maHigh', 'trs', 'ampTrs', 'rsi', 'rsiHigh', 'rsiLow'],
      },
    ];
    this.commonFileds = ['candle', 'tp', 'sl', 'tsl', 'leverage', 'wallet', 'walletLimit'];
  }
  componentDidMount() {
    ipcRenderer.on('loaderEvent', (_e, data: { text: string; step: number; progress?: number }) =>
      this.setState((prev) => ({
        ...prev,
        loadingText: data.text,
        step: data.step,
        progress: data.progress,
        loading: true,
      })),
    );
    ipcRenderer.on(
      'result',
      (
        _e,
        data: {
          data: State['result'];
          start: number;
          end: number;
          all: number;
          startWork: number;
          candles: number[][];
          indicators: {
            trix: number[];
            sma: number[];
          };
        },
      ) =>
        this.setState((prev) => ({
          ...prev,
          result: data.data,
          step: 6,
          all: data.all,
          dataStart: data.start,
          dataEnd: data.end,
          startWork: data.startWork,
          candles: data.candles,
          endTest: new Date().getTime(),
          indicators: data.indicators,
        })),
    );
    ipcRenderer.on('error', (_e, error: string) => this.setState((prev) => ({ ...prev, error })));
    const storeData = ipcRenderer.sendSync('get-store-data') as State | undefined;
    if (storeData) {
      if (Object.keys(storeData.sett).length < Object.keys(this.state.sett).length) {
        storeData.sett = { ...this.state.sett, ...storeData.sett };
        storeData.usePlot = storeData.usePlot || false;
      }
      this.setState(() => ({ ...storeData }));
    } else {
      this.saveData();
    }
    this.Chart = dynamic(() => import('react-apexcharts'), { ssr: false });
  }
  saveData() {
    const toSave = { ...this.state };
    delete toSave.loadingText;
    delete toSave.step;
    delete toSave.steps;
    delete toSave.progress;
    delete toSave.result;
    delete toSave.error;
    delete toSave.all;
    delete toSave.dataStart;
    delete toSave.dataEnd;
    delete toSave.startWork;
    delete toSave.anchor;
    delete toSave.filter;
    delete toSave.candles;
    delete toSave.endTest;
    delete toSave.chartMax;
    delete toSave.chartMin;
    delete toSave.indicators;
    ipcRenderer.send('store-data', { ...toSave });
  }
  handleChangeSelect(select: 'history' | 'pair' | 'strategy', value: string) {
    this.setState(
      (prev) => ({ ...prev, [select]: value, result: undefined, candles: undefined, indicators: undefined }),
      this.saveData,
    );
  }
  handleChangeDate(type: 'start' | 'end', value: number | null) {
    if (value) {
      this.setState(
        (prev) => ({
          ...prev,
          [type]: new Date(value).getTime(),
          result: undefined,
          candles: undefined,
          indicators: undefined,
        }),
        this.saveData,
      );
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
        result: undefined,
        candles: undefined,
        indicators: undefined,
      }),
      this.saveData,
    );
  }
  handleChangeSwitch(field = 'usePlot', value: boolean) {
    this.setState(
      (prev) => ({
        ...prev,
        [field]: value,
      }),
      this.saveData,
    );
  }
  openMenu(event: React.MouseEvent<HTMLElement>) {
    //@ts-ignore
    this.setState((prev) => ({ ...prev, anchor: event.target }));
  }
  closeMenu() {
    this.setState((prev) => ({ ...prev, anchor: undefined }));
  }
  closeDialog() {
    ipcRenderer.send('cancel');
    this.setState((prev) => ({
      ...prev,
      loading: false,
    }));
  }
  startLoading() {
    const sett = { ...this.state.sett };
    let send = true;
    Object.keys(sett).map((item) => {
      if (isNaN(parseFloat(`${sett[item]}`))) {
        send = false;
        //@ts-ignore
        this.setState((prev) => {
          const st = prev;
          if (st.errors) {
            return {
              ...prev,
              errors: { ...prev.errors, [item]: true },
            };
          } else {
            return {
              ...prev,
              errors: { [item]: true },
            };
          }
        });
      }
      sett[item] = parseFloat(`${sett[item]}`);
    });
    if (send) {
      ipcRenderer.send('data', { ...this.state, sett });
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
        candles: undefined,
        chartMax: undefined,
        chartMin: undefined,
        indicators: undefined,
      }));
    }
  }
  setFilter(filter?: 'profit' | 'loss') {
    this.setState((prev) => ({ ...prev, filter, anchor: undefined }));
  }
  showResult() {
    this.setState((prev) => ({
      ...prev,
      loading: true,
    }));
  }
  openDialogDir() {
    ipcRenderer.send('dirDialog');
  }
  updateChartData(min?: number, max?: number) {
    this.setState((prev) => ({
      ...prev,
      chartMax: max ? Math.floor(max) : undefined,
      chartMin: min ? Math.floor(min) : undefined,
    }));
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
        startWork,
        anchor,
        filter,
        candles,
        endTest,
        usePlot,
        chartMax,
        chartMin,
        indicators,
      },
      handleChangeSelect,
      handleChangeDate,
      handleChangeText,
      handleChangeSwitch,
      closeDialog,
      startLoading,
      closeMenu,
      openMenu,
      setFilter,
      openDialogDir,
      showResult,
      updateChartData,
      pairs,
      histories,
      time,
      math,
      strategies,
      visible,
      commonFileds,
      Chart,
    } = this;
    let probProfit = 0;
    let avgProfit = 0;
    let avgLoss = 0;
    let probLoss = 0;
    if (result) {
      probProfit = math.round((result.profit.buy + result.profit.sell) / result.all, 2) || 0;
      avgProfit = math.round(result.profit.amount / (result.profit.buy + result.profit.sell)) || 0;
      avgLoss = -math.round(result.loss.amount / (result.loss.buy + result.loss.sell)) || 0;
      probLoss = result.all > 0 ? math.round(1 - probProfit, 2) || 0 : 0;
    }
    const offset = -new Date().getTimezoneOffset() * 60 * 1000;
    const d = {
      series: [] as { name?: string; type: 'line' | 'area' | 'candlestick'; data: (number | null)[] }[],
      options: {
        grid: {
          show: false,
        },
        annotations: {
          xaxis: [] as {
            x: number;
            x2: number;
            fillColor: string;
            label: {
              text: string;
              style: {
                color: string;
              };
            };
            borderWidth: number;
            borderColor: string;
          }[],
        },
        chart: {
          height: 350,
          id: 'candles',
          locales: [ua],
          defaultLocale: 'ua',
          toolbar: {
            tools: {
              download: false,
              pan: false,
            },
          },
          zoom: {
            type: 'x' as 'x',
            enabled: true,
            autoScaleYaxis: true,
          },
          animations: {
            enabled: false,
          },
          events: {
            zoomed: (_con: any, e: { xaxis: { min: number; max: number } }) =>
              updateChartData(e.xaxis.min - offset, e.xaxis.max - offset),
          },
          group: 'resultCharts',
        },
        markers: {
          size: 0,
        },
        dataLabels: {
          enabled: false,
        },
        xaxis: {
          type: 'datetime' as 'datetime',
          labels: {
            style: {
              colors: '#e7e7e7',
            },
          },
          tooltip: {
            enabled: false,
          },
        },
        yaxis: {
          tooltip: {
            enabled: false,
          },
          labels: {
            style: {
              colors: ['#e7e7e7'],
            },
          },
        },
        tooltip: {
          theme: 'dark' as 'dark',
          x: {
            format: 'dd.MM.yy HH:mm:ss',
          },
        },
        stroke: {
          curve: 'smooth' as 'smooth',
          lineCap: 'round' as 'round',
          width: 1.75,
        },
        labels: [] as string[],
      },
    };
    let indic = false;
    let dInd = { ...d };
    if (candles && usePlot) {
      let startC = 0;
      const useCandles = candles.filter((c, ind) => {
        const expr = c[4] > (chartMin || 0) && c[4] < (chartMax || Infinity);
        if (expr && startC === 0) {
          startC = ind;
        }
        return expr;
      });
      const norm = useCandles.length > 1000 ? Math.floor((useCandles.length - 1) / 1000) : 1;
      const x: number[] = [];
      const y: number[] = [];
      const trixSma: { trix: number[]; sma: number[] } = { trix: [], sma: [] };
      useCandles.map((c, ind) => {
        if (ind % norm === 0 || ind === 0) {
          if (indicators && indicators.trix && indicators.sma) {
            trixSma.trix.push(indicators.trix[startC + ind]);
            trixSma.sma.push(indicators.sma[startC + ind]);
          }
          x.push(c[4] + offset);
          y.push(c[1]);
          return;
        }
      });
      d.series[0] = {
        name: 'ціна закриття',
        type: 'line',
        data: y,
      };
      d.options.labels = x.map((item) => `${new Date(item)}`);
      if (result && result.hist && result.hist.length > 0) {
        result.hist
          .filter((pos: any) => (filter ? (filter === 'loss' ? pos.net <= 0 : pos.net > 0) : true))
          .filter((pos: any) => pos.time > (chartMin || 0) && pos.time < (chartMax || Infinity))
          .map((pos: any) => {
            d.options.annotations.xaxis.push({
              x: pos.time + offset,
              x2: pos.closeTime + offset,
              fillColor: pos.net > 0 ? green['A700'] : red['A700'],
              label: {
                text: pos.type === 'SELL' ? 'продажа' : 'покупка',
                style: {
                  color: pos.net > 0 ? green['A700'] : red['A700'],
                },
              },
              borderWidth: 0,
              borderColor: '#ffffff00',
            });
          });
      }
      if (trixSma.trix.length > 0 && trixSma.sma.length > 0) {
        indic = true;
        dInd = {
          ...d,
          series: [],
          options: {
            ...d.options,
            yaxis: { ...d.options.yaxis },
            chart: { ...d.options.chart },
            annotations: { ...d.options.annotations },
          },
        };
        dInd.series.push({ name: 'trix', type: 'line', data: trixSma.trix });
        dInd.series.push({ name: 'sma', type: 'line', data: trixSma.sma });
        dInd.options.chart.height = 250;
        dInd.options.chart.id = 'indicators';
        //@ts-ignore
        dInd.options.annotations.yaxis = [
          {
            y: sett.upper,
            y2: sett.lower,
            fillColor: grey[500],
            borderWidth: 0,
            borderColor: '#ffffff00',
          },
        ];
        dInd.options.yaxis = {
          tooltip: {
            enabled: false,
          },
          labels: {
            style: {
              colors: ['#e7e7e7'],
            },
          },
          //@ts-ignore
          tickAmount: 3,
          //@ts-ignore
          decimalsInFloat: 3,
        };
        //@ts-ignore
        dInd.options.legend = {
          labels: {
            useSeriesColors: true,
          },
        };
      }
    }
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 8);
    startDate.setDate(1);
    return (
      <>
        <Head>
          <title>MT Симуляції</title>
        </Head>
        <Dialog
          open={loading}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
          fullScreen
        >
          <DialogTitle id="alert-dialog-title">Симуляція в процесі</DialogTitle>
          <DialogContent dividers>
            {error ? (
              <DialogContentText
                id="alert-dialog-description"
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
                      <Card sx={{ maxWidth: '50%', flexGrow: 1, marginRight: 2 }}>
                        <CardHeader
                          title="Результат"
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
                          з {sett.wallet} $
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
                              color: probProfit * avgProfit - probLoss * avgLoss > 0 ? green[500] : red[500],
                              display: 'inline-block',
                            }}
                          >
                            {(math.round(probProfit * avgProfit - probLoss * avgLoss) || 0).toLocaleString()} $
                          </Typography>
                          <br />
                          Позицій: {result.all.toLocaleString()}
                          <br />
                          Прибуткових позицій: {result.profit.buy + result.profit.sell} (продажа - {result.profit.sell},
                          покупка - {result.profit.buy})
                          <br />
                          Збиткових позицій: {result.loss.buy + result.loss.sell} (продажа - {result.loss.sell}, покупка
                          - {result.loss.buy})
                          <br />
                          Загальний профіт: {result.profit.amount.toLocaleString()} $ (продажа -{' '}
                          {result.profit.sellAmount.toLocaleString()} $, покупка -{' '}
                          {result.profit.buyAmount.toLocaleString()} $)
                          <br />
                          Загальний збиток: {result.loss.amount.toLocaleString()} $ (продажа -{' '}
                          {result.loss.sellAmount.toLocaleString()} $, покупка -{' '}
                          {result.loss.buyAmount.toLocaleString()} $)
                          <br />
                          Вирогідність профіту: {math.round(probProfit * 100, 0)}%
                          <br />
                          Середній профіт: {avgProfit.toLocaleString()} $
                          <br />
                          Середній збиток: {avgLoss.toLocaleString()} $
                          <br />
                          Точність лонгів:{' '}
                          {math.round((result.profit.buy / (result.profit.buy + result.loss.buy)) * 100, 0) || 0}
                          %<br />
                          Точність шортів:{' '}
                          {math.round((result.profit.sell / (result.profit.sell + result.loss.sell)) * 100, 0) || 0}%
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
                          title="Позиції"
                          action={
                            <IconButton onClick={openMenu}>
                              <Badge color="secondary" variant="dot" invisible={!Boolean(filter)}>
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
                          <MenuItem onClick={() => setFilter()} selected={!Boolean(filter)}>
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
                                    return pos.net > 0;
                                  }
                                  if (filter === 'loss') {
                                    return pos.net <= 0;
                                  }
                                }
                                return true;
                              })
                              .map((pos: any) => (
                                <Card key={pos.id} raised sx={{ marginBottom: 2 }}>
                                  <CardContent>
                                    Сторона: {pos.type === 'SELL' ? 'продажа' : 'покупка'}
                                    <br />
                                    Ціна відкриття: {pos.price.toLocaleString()}
                                    <br />
                                    Ціна закриття: {pos.closePrice.toLocaleString()}
                                    <br />
                                    Вартість позиції: {pos.cost.toLocaleString()} $
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
                                        color: pos.net > 0 ? green[500] : red[500],
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
                    <FormControlLabel
                      control={
                        <Switch checked={usePlot} onChange={(e) => handleChangeSwitch('usePlot', e.target.checked)} />
                      }
                      label={`${usePlot ? 'Будувати графік' : 'Не будувати графік'}`}
                      sx={{ marginTop: 2 }}
                    />
                    {usePlot && candles && candles.length > 0 && Chart && (
                      <Card sx={{ width: 'calc(100% - 16px)', marginTop: 2 }}>
                        <CardHeader title="Графік" />
                        <CardContent>
                          <Chart options={d.options} series={d.series} height={350} />
                          {indic && <Chart options={dInd.options} series={dInd.series} height={250} />}
                        </CardContent>
                      </Card>
                    )}
                    <Typography sx={{ marginTop: 2 }}>
                      Старт виконання тесту: {time.format(startWork || start)}
                      <br /> Кінець виконання тесту: {time.format(endTest || new Date().getTime())}{' '}
                    </Typography>
                  </>
                ) : (
                  <>
                    <DialogContentText
                      id="alert-dialog-description"
                      sx={{
                        width: '100%',
                        marginTop: 3,
                        color: 'text.primary',
                      }}
                    >
                      {loadingText ? <div dangerouslySetInnerHTML={{ __html: loadingText }} /> : 'Підготовка...'}
                    </DialogContentText>
                    <LinearProgress
                      color="secondary"
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
        <AppBar position="static">
          <Toolbar>
            <Typography variant="subtitle1" component="div" sx={{ flexGrow: 1 }}>
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
            <InputLabel id="pair">Пара</InputLabel>
            <Select
              labelId="pair"
              id="pair-select"
              value={pair}
              label="пара"
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
                renderInput={(props) => <TextField {...props} sx={{ marginTop: 2, marginRight: 2 }} />}
                label="Початок періоду"
                value={start}
                onChange={(newValue) => {
                  handleChangeDate('start', newValue);
                }}
                maxDate={end}
                minDate={startDate.getTime()}
                mask="__.__.____ __:__"
              />
              <DateTimePicker
                renderInput={(props) => <TextField {...props} sx={{ marginTop: 2 }} />}
                label="Кінець періоду"
                value={end}
                onChange={(newValue) => {
                  handleChangeDate('end', newValue);
                }}
                maxDate={new Date().getTime()}
                minDate={start}
                mask="__.__.____ __:__"
              />
            </Box>
          </LocalizationProvider>
          <Box>
            <FormControl sx={{ width: 200, marginTop: 2, marginRight: 2 }}>
              <InputLabel id="strategy">Стратегія</InputLabel>
              <Select
                labelId="strategy"
                id="startegy-select"
                value={strategy}
                label="стратегія"
                onChange={(e) => handleChangeSelect('strategy', e.target.value)}
              >
                {strategies.map((item) => (
                  <MenuItem key={item} value={item}>
                    {
                      //@ts-ignore
                      translate[item]
                    }
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl sx={{ width: 200, marginTop: 2 }}>
              <InputLabel id="history">Вікно історії</InputLabel>
              <Select
                labelId="history"
                id="history-select"
                value={history}
                label="вікно історії"
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
            {Object.keys(sett).map((item, ind) => {
              const vInd = visible.findIndex((vItem) => vItem.strategy === strategy);
              if (vInd !== -1) {
                if (visible[vInd].fields.includes(item) || commonFileds.includes(item)) {
                  return (
                    <Grid item lg={3} md={3} sm={3} sx={{ width: 216 }} key={`${item}-${ind}`}>
                      <TextField
                        label={translate[item]}
                        value={sett[item]}
                        error={errors && errors[item]}
                        //@ts-ignore
                        onChange={(e) => handleChangeText(item, e.target.value)}
                      />
                    </Grid>
                  );
                }
              }
            })}
          </Grid>
          <Stack direction="row">
            <Button
              variant="contained"
              type="submit"
              sx={{ width: 200, marginTop: 2, height: 48 }}
              onClick={startLoading}
            >
              Старт
            </Button>
            {result && (
              <Button
                variant="contained"
                type="submit"
                sx={{ width: 200, marginLeft: 2, marginTop: 2, height: 48 }}
                onClick={showResult}
              >
                результат
              </Button>
            )}
          </Stack>
        </Box>
      </>
    );
  }
}

export default Index;
