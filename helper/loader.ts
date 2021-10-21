import fetch from 'isomorphic-unfetch';
import fs from 'fs';
import { Time, getFileLinesSync } from '@mt-inc/utils';
import Zip from 'adm-zip';
import Binance from 'binance-api-node';
import sha256File from 'sha256-file';
import Positions, { Candle } from '@mt-inc/bot';
import { TrixBot, MAbot } from '@mt-inc/strategy';
import { parentPort, workerData } from 'worker_threads';
import type { HistoryType } from '@mt-inc/strategy/dist/esm';
import type { Pairs } from '@mt-inc/utils/dist/esm/src/const';

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
};

export class Loader {
  private data: State;
  private path: string;
  private time: Time;
  private url: string;
  private cancel: boolean;
  private checksums: string[];
  private loaded: number;
  private startWork: number;
  private candles: number[][];
  private trix: (number | null)[];
  private sma: (number | null)[];
  private emaLow: (number | null)[];
  private emaHigh: (number | null)[];
  private rsi: (number | null)[];
  private wallet: number[];
  constructor(data: State & { userData: string }) {
    const { userData, ...rest } = data;
    this.data = rest;
    let tmpDate = new Date(this.data.start);
    tmpDate.setUTCMilliseconds(0);
    tmpDate.setUTCSeconds(0);
    this.data.start = tmpDate.getTime();
    tmpDate = new Date(this.data.end);
    tmpDate.setUTCMilliseconds(0);
    tmpDate.setUTCSeconds(0);
    this.data.end = tmpDate.getTime();
    this.time = new Time();
    this.path = `${userData}/data/${this.data.pair}`;
    this.url = `https://data.binance.vision/data/futures/um/daily/aggTrades/${this.data.pair}`;
    if (!fs.existsSync(`${userData}/data`)) {
      fs.mkdirSync(`${userData}/data`);
    }
    if (!fs.existsSync(this.path)) {
      fs.mkdirSync(this.path);
    }
    this.checksums = [];
    this.loaded = 0;
    this.startWork = new Date().getTime();
    this.cancel = false;
    this.candles = [];
    this.trix = [];
    this.sma = [];
    this.emaLow = [];
    this.emaHigh = [];
    this.rsi = [];
    this.wallet = [];
  }
  private sendMessage(data: any) {
    parentPort?.postMessage({ ...data });
  }
  async loadData() {
    try {
      const { start, end, pair } = this.data;
      const startDate = new Date(start);
      const endDate = new Date(end);
      const fileNames = [];
      let api = { start, end, active: false };
      endDate.setUTCHours(23);
      endDate.setUTCMinutes(59);
      endDate.setUTCSeconds(59);
      endDate.setUTCMilliseconds(999);
      startDate.setUTCHours(0);
      startDate.setUTCMinutes(0);
      startDate.setUTCSeconds(0);
      startDate.setUTCMilliseconds(0);
      for (let i = start; i <= endDate.getTime(); i = i + 24 * 60 * 60 * 1000) {
        const d = new Date(i);
        const y = d.getUTCFullYear();
        const m = d.getUTCMonth() + 1;
        const D = d.getUTCDate();
        fileNames.push(`${pair}-aggTrades-${y}-${m < 10 ? `0${m}` : m}-${D < 10 ? `0${D}` : D}.zip`);
      }
      const existFiles = await this.checkFiles([...fileNames]);
      if (
        fileNames.length > existFiles.length &&
        existFiles.length > 0 &&
        fileNames[fileNames.length - 1] !== existFiles[existFiles.length - 1]
      ) {
        const last = existFiles[existFiles.length - 1];
        const splitZip = last.split('.zip')[0];
        const splitDateArr = splitZip.split('-');
        const splitDate = splitDateArr[splitDateArr.length - 1];
        const apiStartDate = new Date();
        apiStartDate.setUTCDate(parseInt(splitDate) + 1);
        apiStartDate.setUTCMonth(parseInt(splitDateArr[splitDateArr.length - 2]) - 1);
        apiStartDate.setUTCFullYear(parseInt(splitDateArr[splitDateArr.length - 3]));
        apiStartDate.setUTCHours(0);
        apiStartDate.setUTCMinutes(0);
        apiStartDate.setUTCSeconds(0);
        apiStartDate.setUTCMilliseconds(0);
        api = {
          ...api,
          active: true,
          start: apiStartDate.getTime(),
        };
      } else if (existFiles.length === 0) {
        api.active = true;
      }
      if (existFiles.length > 0) {
        this.sendMessage({
          event: 'loaderEvent',
          text: `Підготовку завершено.${
            existFiles.length > 0 ? `</br>Буде завантажено файлів: ${existFiles.length}.` : ''
          }${
            api.active
              ? `</br>Дані з ${this.time.format(api.start)} по ${this.time.format(api.end)} буде завантажено по API.`
              : ''
          }`,
          progress: 0.00001,
          step: 1,
        });
        await this.loadFiles(existFiles);
        this.sendMessage({
          event: 'loaderEvent',
          text: `Починаємо розпаковку`,
          progress: 0.00001,
          step: 2,
        });
        await this.unzipFiles(existFiles);
      }
      if (api.active) {
        this.sendMessage({
          event: 'loaderEvent',
          text: `Починаємо завантаження по API`,
          progress: 0,
          step: 3,
        });
        const now = new Date().getTime();
        await this.loadAPIData({
          startTime: api.start,
          endTime: api.end > now ? now : api.end,
        });
      }
      this.sendMessage({
        event: 'loaderEvent',
        text: `Перевіряємо збережені дані`,
        step: 4,
      });
      const resNow = this.checkData(start, end);
      this.sendMessage({
        event: 'loaderEvent',
        text: `Початок симуляції</br>В період з ${this.time.format(resNow?.start || start)} до ${this.time.format(
          resNow?.end || end,
        )} було ${resNow?.c.toLocaleString()} угод`,
        progres: 0.5,
        step: 5,
      });
      this.makeTest(resNow?.c, resNow?.start, resNow?.end);
      this.clearFolder();
    } catch (e: any) {
      if (e.code === 'ENOTFOUND' && e.erroredSysCall === 'getaddrinfo') {
        this.sendMessage({ event: 'error', text: "Немає інтернет-з'єднання" });
        return;
      }
      this.sendMessage({ event: 'error', text: JSON.stringify(e) });
    }
  }
  private getFiles() {
    const { start, end } = this.data;
    return fs
      .readdirSync(this.path)
      .filter((file) => file.indexOf('.csv') !== -1)
      .filter((item) => {
        if (item.indexOf('zzz.csv') !== -1) {
          return true;
        }
        const split = item.split('.csv')[0].split('-');
        const startDate = new Date(start);
        const endDate = new Date(end);
        const splitDate = new Date();
        splitDate.setUTCDate(parseInt(split[split.length - 1]));
        splitDate.setUTCMonth(parseInt(split[split.length - 2]) - 1);
        splitDate.setUTCFullYear(parseInt(split[split.length - 3]));
        startDate.setUTCHours(0);
        startDate.setUTCMinutes(0);
        startDate.setUTCSeconds(0);
        startDate.setUTCMilliseconds(0);
        endDate.setUTCHours(23);
        endDate.setUTCMinutes(59);
        endDate.setUTCSeconds(59);
        endDate.setUTCMilliseconds(999);
        return splitDate.getTime() > startDate.getTime() && splitDate.getTime() < endDate.getTime();
      });
  }
  async checkFiles(fileNames: string[]) {
    try {
      const checkFiles = fileNames.map(async (file) => {
        if (!this.cancel) {
          const req = await fetch(`${this.url}/${file}.CHECKSUM`).then((res: any) => res);
          if (req.status !== 200) {
            const ind = fileNames.findIndex((item) => item === file);
            if (ind !== -1) {
              fileNames.splice(ind, 1);
            }
          } else {
            const buf = await req.blob();
            const txt = await buf.text();
            this.checksums.push(txt.replace('\n', ''));
          }
        }
      });
      await Promise.all(checkFiles);
      return fileNames;
    } catch (e) {
      throw e;
    }
  }
  async loadFiles(fileNames: string[]) {
    const all = fileNames.length;
    const downloadFiles = fileNames.map(async (file) => {
      if (!this.cancel) {
        const save = `${this.path}/${file}`;
        let load = true;
        if (fs.existsSync(save)) {
          const checksum = sha256File(save);
          const savedCheckSum = this.checksums.filter((item) => item.split('  ')[1] === file)[0];
          if (savedCheckSum && checksum === savedCheckSum.split('  ')[0]) {
            load = false;
          }
        }
        if (load) {
          const req = await fetch(`${this.url}/${file}`).then((res: any) => res.blob());
          const buf = await req.arrayBuffer();
          fs.writeFileSync(save, Buffer.from(buf));
        }
        this.loaded++;
        this.sendMessage({
          event: 'loaderEvent',
          text: `${file} завантажено до:</br>${save}`,
          progress: Math.round((this.loaded / all) * 100),
          step: 1,
        });
      }
    });
    try {
      await Promise.all(downloadFiles);
    } catch (e: any) {
      if (e.code === 'ECONNRESET') {
        await Promise.all(downloadFiles);
        return;
      }
      throw e;
    }
  }
  async unzipFiles(fileNames: string[]) {
    const all = fileNames.length;
    let make = 0;
    fileNames.map((file) => {
      if (!this.cancel) {
        const zip = new Zip(`${this.path}/${file}`);
        const entry = zip.getEntries()[0].entryName;
        if (!fs.existsSync(`${this.path}/${entry}`)) {
          zip.extractAllTo(this.path);
        }
        make++;
        this.sendMessage({
          event: 'loaderEvent',
          text: `${file} розархівовано до:</br>${this.path}/${entry}`,
          progress: Math.round((make / all) * 100),
          step: 2,
        });
      }
    });
  }
  async loadAPIData(options: { startTime: number; endTime: number }, c = 0, firstRun = true) {
    const { pair } = this.data;
    const { startTime, endTime } = options;
    const client = Binance();
    let fR = firstRun;
    if (startTime < endTime && !this.cancel) {
      try {
        const res = await client.futuresAggTrades({
          symbol: pair,
          startTime,
          limit: 1000,
        });
        const lastTime = res[res.length - 1].timestamp;
        const toWrite = res.filter((item) => item.timestamp < lastTime && item.timestamp < endTime);
        c += toWrite.length;
        const fileName = `${this.path}/zzzzzzzzzzzzzzzzzzzzzzzzzz.csv`;
        if (fR) {
          if (fs.existsSync(fileName)) {
            fs.truncateSync(fileName);
            fR = false;
          }
        }
        fs.appendFileSync(
          fileName,
          `${toWrite
            .map(
              (item) =>
                `${item.aggId},${item.price},${item.quantity},${item.firstId},${item.lastId},${item.timestamp},${item.isBuyerMaker}`,
            )
            .join('\n')}\n`,
        );
        this.sendMessage({
          event: 'loaderEvent',
          text: `Завантажено угод: ${c}. Остання за ${this.time.format(
            toWrite[toWrite.length - 1].timestamp,
          )}.</br>Збережено до: ${fileName}`,
          step: 3,
        });
        await new Promise((res) => res(this.loadAPIData({ startTime: lastTime, endTime }, c, fR)));
      } catch (e: any) {
        if (e.code === 'ENOTFOUND' && e.erroredSysCall === 'getaddrinfo') {
          throw e;
        }
        await new Promise((res) => setTimeout(() => res(this.loadAPIData({ startTime, endTime }, c, fR)), 5000));
      }
    } else if (startTime >= endTime) {
      this.sendMessage({
        event: 'loaderEvent',
        text: `Завантаження по API завершено`,
        progress: 100,
        step: 3,
      });
    }
  }
  checkData(startFrom = 0, endTo = new Date().getTime()) {
    if (!this.cancel) {
      let c = 0;
      let start = 0;
      let end = 0;
      let files = this.getFiles();
      for (let i = 0; i < files.length; i++) {
        if (!this.cancel) {
          const file = files[i];
          const data = getFileLinesSync(`${this.path}/${file}`, 'utf8');
          for (const d of data) {
            if (!this.cancel) {
              let [_aggId, p, v, _firstId, _lastId, time, _wasMaker] = d.split(',');
              const t = parseInt(time);
              if (p && v && t) {
                if (t > startFrom && t < endTo) {
                  if (c === 0) {
                    start = t;
                  }
                  c++;
                  end = t;
                }
              }
            }
          }
        }
      }
      return { c, start, end };
    }
  }
  clearFolder() {
    const files = fs.readdirSync(this.path);
    files.map((file) => {
      if (file.indexOf('.csv') !== -1) {
        fs.unlinkSync(`${this.path}/${file}`);
      }
    });
  }
  makeTest(all?: number, s?: number, e?: number) {
    if (!this.cancel && all) {
      const start = s || this.data.start;
      const end = e || this.data.end;
      const { sett, history, pair } = this.data;
      const files = this.getFiles();
      let now = 0;
      let nowTime = 0;
      let c = 0;
      let bot: TrixBot | MAbot | null = null;
      if (this.data.strategy === 'trix') {
        bot = new TrixBot({
          trixPeriod: sett.trix,
          smaPeriod: sett.sma,
          upper: sett.upper,
          lower: sett.lower,
          type: 'trix',
          history: history as HistoryType,
        });
      }
      if (
        this.data.strategy === 'sma' ||
        this.data.strategy === 'ema' ||
        this.data.strategy === 'sma+rsi' ||
        this.data.strategy === 'ema+rsi'
      ) {
        bot = new MAbot({
          maLow: sett.maLow,
          maHigh: sett.maHigh,
          trs: sett.trs,
          rsi: sett.rsi,
          upper: sett.rsiHigh,
          lower: sett.rsiLow,
          ampTrs: sett.ampTrs,
          type: this.data.strategy,
          history: this.data.history as HistoryType,
        });
      }
      let wallet = sett.wallet;
      const positions = new Positions(
        sett.wallet,
        sett.walletLimit,
        sett.leverage,
        undefined,
        pair as Pairs,
        undefined,
        undefined,
        undefined,
        undefined,
        (net) => {
          wallet += net;
          if (wallet < 1) {
            wallet = 1;
          }
        },
        undefined,
        {
          tpP: sett.tp,
          slP: sett.sl,
        },
        { tSlP: sett.tsl },
        true,
      );
      const candles = new Candle(sett.candle, (data: number[]) => {
        this.candles.push(data);
        bot?.work(data, now, positions, undefined, nowTime);
        if (this.data.strategy === 'trix') {
          const d = bot?.historyTechData as { trix: number[] | undefined; sma: number[] | undefined };
          if (d.trix) {
            this.trix.push(d.trix[d.trix.length - 1]);
          }
          if (!d.trix) {
            this.trix.push(null);
          }
          if (d.sma) {
            this.sma.push(d.sma[d.sma.length - 1]);
          }
          if (!d.sma) {
            this.sma.push(null);
          }
        }
        if (this.data.strategy.indexOf('ma') !== -1) {
          const d = bot?.historyTechData as {
            low: number[] | undefined;
            high: number[] | undefined;
            rsi: number[] | undefined;
          };
          if (d.low) {
            this.emaLow.push(d.low[d.low.length - 1]);
          }
          if (!d.low) {
            this.emaLow.push(null);
          }
          if (d.high) {
            this.emaHigh.push(d.high[d.high.length - 1]);
          }
          if (!d.high) {
            this.emaHigh.push(null);
          }
          if (this.data.strategy.indexOf('rsi') !== -1) {
            if (d.rsi) {
              this.rsi.push(d.rsi[d.rsi.length - 1]);
            }
            if (!d.rsi) {
              this.rsi.push(null);
            }
          }
        }
        this.wallet.push(wallet);
      });
      for (let i = 0; i < files.length; i++) {
        const item = files[i];
        const data = getFileLinesSync(`${this.path}/${item}`, 'utf8');
        for (const d of data) {
          let [_aggId, p, v, _firstId, _lastId, time, _wasMaker] = d.split(',');
          const t = parseInt(time);
          if (p && v && t) {
            if (t >= start && t <= end) {
              now = parseFloat(p);
              nowTime = t;
              candles.push(now, parseFloat(v), t);
              if (positions) {
                positions.checkPositionRt(now, nowTime);
              }
              c++;
              if (c % (all > 10000000 ? 300000 : 100000) === 0) {
                this.sendMessage({
                  event: 'loaderEvent',
                  text: `Початок симуляції</br>В період з ${this.time.format(start)} до ${this.time.format(
                    end,
                  )} було ${all.toLocaleString()} угод</br>Виконано ${c.toLocaleString()} / ${all.toLocaleString()}`,
                  progress: Math.round((c / all) * 100),
                  step: 5,
                });
              }
            }
          }
        }
      }
      this.sendMessage({
        event: 'result',
        data: positions.currentResult,
        start,
        end,
        all,
        startWork: this.startWork,
        candles: this.candles,
        indicators: {
          trix: this.trix.length > 0 ? this.trix : undefined,
          sma: this.sma.length > 0 ? this.sma : undefined,
          emaLow: this.emaLow.length > 0 ? this.emaLow : undefined,
          emaHigh: this.emaHigh.length > 0 ? this.emaHigh : undefined,
          rsi: this.rsi.length > 0 ? this.rsi : undefined,
        },
        wallet: this.wallet,
      });
    }
  }
}

new Loader(workerData.data).loadData();
