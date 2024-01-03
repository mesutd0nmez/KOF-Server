# KOF-Server

This project is the server of [KOF-Bot](https://github.com/trkyshorty/KOF-Bot), and licensing, anti-cracking report, automatic updating, user/client management and management of KnightOnline.exe addresses are done through the server

To use KOF-Server, you need to have Docker installed

> Docker is not needed for the development environment

After completing the necessary requirements, you can start the KOF-Server

## Table of Contents

- [Requirements](#requirements)
- [Encryption](#encryption)
- [Configuration](#configuration)
- [Installation](#installation)
- [Development](#development)
- [Production](#production)

## Requirements

- Docker

## Encryption

KOF-Server utilizes **AES-256 CBC** encryption, and the keys for this encryption are configured through the **.env** file.

These keys must be **64** characters in length.

When generating the keys, it is also to replace them in the ***KOF.Bot\Service.cpp*** and ***KOF.Bot\Cryption.h*** files.

## Configuration

Before starting the installation, you need to complete the server settings. You can create the default configuration file by running the following command

```bash
cp .env.example .env
```

After opening the .env file with any text editor and completing the necessary settings, you can proceed with the installation

## Installation

If you want to use the project in a development environment, it is necessary to have Mongo server installed in your working environment

After configuring the necessary settings, proceed to start

## Development

```bash
npm install
```

After the installation is complete, run the following command to start server:

```bash
npm run dev
```

## Production

```bash
docker compose build
```

After the installation is complete, run the following command to start server:

```bash
docker compose up
```

Use the following command for update:

```bash
docker compose --no-cache build
```
