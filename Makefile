PROJECT = map-circle-control
SRC = $(wildcard lib/*.js)

all: check compile

check: lint test

lint:
	./node_modules/.bin/biome ci

format:
	./node_modules/.bin/biome check --fix

test:
	node --require jsdom-global/register --test

build/index.js: $(SRC)
	./node_modules/.bin/esbuild \
		--bundle \
		--global-name=_mc \
		--outfile=$@ \
		lib/map-circle-control.js

clean:
	rm -rf build

compile: build/index.js

.PHONY: check format lint test
