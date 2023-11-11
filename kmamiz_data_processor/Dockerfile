FROM rust:bookworm as builder

WORKDIR /usr/src/kmamiz
RUN mkdir src && echo "fn main() {}" > src/main.rs
COPY Cargo.toml .
COPY Cargo.lock .
RUN cargo build --release
RUN rm -rf ./src ./target/release
COPY src src
RUN cargo install --path .

FROM debian:bookworm-slim
WORKDIR /usr/app/kmamiz
COPY .env .
COPY --from=builder /usr/local/cargo/bin/kmamiz_data_processor /usr/local/bin/kmamiz_data_processor
RUN apt-get update && apt install -y openssl
CMD [ "kmamiz_data_processor" ]
