FROM ghcr.io/foundry-rs/foundry:nightly-61749757a29a3c4a3a3790e718f303d95efeb509 AS foundry
FROM node:16.16-alpine

COPY --from=foundry /usr/local/bin/forge /usr/local/bin/forge
COPY --from=foundry /usr/local/bin/cast /usr/local/bin/cast
COPY --from=foundry /usr/local/bin/anvil /usr/local/bin/anvil

RUN anvil -V
