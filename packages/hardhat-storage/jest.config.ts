import type { JestConfigWithTsJest } from 'ts-jest';

const jestConfig: JestConfigWithTsJest = {
  preset: 'ts-jest',
  moduleFileExtensions: ['js', 'ts', 'json', 'sol'],
  collectCoverageFrom: ['./src/**/*.ts'],
};

export default jestConfig;
