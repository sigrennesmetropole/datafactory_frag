FROM          node:alpine3.14
COPY          . /root/app/
WORKDIR       /root/app/
RUN           yarn && yarn build

FROM          alpine:3.14.0
COPY --from=0 /usr/local/bin/node /usr/local/bin/
RUN           apk add --no-cache libgcc libstdc++
COPY --from=0 /root/app/build/index.js /usr/local/bin/frag
RUN           ln -s /usr/local/bin/frag /usr/bin/frag
ENV           NODE_ENV=production
WORKDIR       /root
ENTRYPOINT   [ "frag" ]
