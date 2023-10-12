import { integrationBootstrap } from './bootstrap';

describe('cross chain election testing', function () {
  const { chains } = integrationBootstrap();

  it('interacts with the chains', async function () {
    this.timeout(100000);

    const retries = 10; // 10secs
    for (let i = 0; i < retries; i++) {
      const n = await chains[0].provider.getNetwork();
      console.log({ n });
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  });
});
