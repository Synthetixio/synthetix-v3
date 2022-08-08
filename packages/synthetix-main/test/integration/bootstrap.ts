import hre from 'hardhat';

export async function bootstrap() {
    await hre.run('cannon:build');
}