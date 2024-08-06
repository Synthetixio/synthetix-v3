import { inspect, resolveCliSettings } from '@usecannon/cli';

interface InspectOptions {
  packageRef: string;
  chainId: number;
  writeDeployments: string;
}

export async function cannonInspect(options: InspectOptions) {
  const cliSettings = resolveCliSettings();
  return inspect(
    options.packageRef,
    cliSettings,
    options.chainId,
    '',
    false,
    options.writeDeployments,
    true
  );
}
