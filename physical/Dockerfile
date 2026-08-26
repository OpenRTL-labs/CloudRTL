FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y \
        build-essential \
        git \
        wget \
        curl \
        ca-certificates \
        python3 \
        python3-pip \
        python3-venv \
        tcl \
        tcl-dev \
        tk \
        tk-dev \
        m4 \
        flex \
        bison \
        autoconf \
        automake \
        libtool \
        pkg-config \
        libx11-dev \
        libcairo2-dev \
        libglu1-mesa-dev \
        libncurses-dev \
        freeglut3-dev \
        libreadline-dev \
        libffi-dev \
        libxpm-dev \
        libxrender-dev \
        libxext-dev \
        zlib1g-dev \
        swig \
        magic \
        netgen-lvs \
        && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN python3 -m pip install --break-system-packages --no-cache-dir ciel

ENV PATH="/root/.local/bin:${PATH}"

WORKDIR /workspace

CMD ["/bin/bash"]