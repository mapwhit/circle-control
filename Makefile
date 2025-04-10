PROJECT = map-circle-control
SRC = index.js $(wildcard lib/*.js)

all: check compile

check: lint test

lint:
	./node_modules/.bin/biome ci

format:
	./node_modules/.bin/biome check --fix

test:
	node --test

build/index.js: $(SRC)
	./node_modules/.bin/esbuild \
		--bundle \
		--global-name=makeCircle \
		--outfile=$@ \
		index.js

clean:
	rm -rf build

compile: build/index.js

.PHONY: check format lint test
