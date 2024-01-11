PROJECT = map-circle-control
SRC = index.js $(wildcard lib/*.js)

all: check compile

check: lint test

lint:
	./node_modules/.bin/jshint *.js lib test

test:
	./node_modules/.bin/tape test/*js

build/index.js: $(SRC)
	./node_modules/.bin/esbuild \
		--bundle \
		--global-name=makeCircle \
		--outfile=$@ \
		index.js

clean:
	rm -rf build

compile: build/index.js

.PHONY: check lint test
