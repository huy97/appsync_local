export const logger: { [key: string]: (...args: any) => void } = {
  info: (...args: any) => {
    return console.log(...args);
  },
  error: (...args: any) => {
    return console.log(...args);
  },
  warn: (...args: any) => {
    return console.log(...args);
  },
  success: (...args: any) => {
    return console.log(...args);
  },
  log: (...args: any) => {
    return console.log(...args);
  },
};
