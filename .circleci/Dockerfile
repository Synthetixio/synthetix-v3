FROM cimg/node:16.20.1

ENV SHELL="/bin/bash"

ADD ./install-foundry.sh /install-foundry.sh
RUN /install-foundry.sh

ADD ./install-ipfs.sh /install-ipfs.sh
RUN /install-ipfs.sh
