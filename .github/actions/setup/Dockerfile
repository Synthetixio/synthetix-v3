FROM node:16.16

# RUN apk --no-cache add curl
RUN curl -L https://foundry.paradigm.xyz | bash
ENV PATH="${PATH}:/root/.foundry/bin"

RUN foundryup --version nightly-61749757a29a3c4a3a3790e718f303d95efeb509

