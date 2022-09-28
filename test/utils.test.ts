import { fileExtensions } from '../src/lib/utils';

test('foo', () => expect(fileExtensions('foo')).toEqual([]));
test('foo.bar', () => expect(fileExtensions('foo.bar')).toEqual(['bar']));
test('foo.bar.baz', () => expect(fileExtensions('foo.bar.baz')).toEqual(['bar', 'baz']));
test('foo.bar.baz.gz', () => expect(fileExtensions('foo.bar.baz.gz')).toEqual(['bar', 'baz', 'gz']));