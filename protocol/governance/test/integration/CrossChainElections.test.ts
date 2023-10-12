import { integrationBootstrap } from './bootstrap';

describe('cross chain election testing', function () {
  const { chains } = integrationBootstrap();

  it('interacts with chains', async function () {
    const n = await chains[0].provider.getNetwork();
    console.log({ n });
  });
});
