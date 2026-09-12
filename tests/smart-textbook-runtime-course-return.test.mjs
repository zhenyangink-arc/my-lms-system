import test from 'node:test';
import assert from 'node:assert/strict';
import {courseReturnHref} from '../src/features/smart-textbook-runtime/core/course-return.ts';
test('host course destinations accepted; external, encoded and unrelated locations rejected',()=>{
  for(const path of ['/dashboard/courses','/student/dashboard/courses/korean/level-one','/dashboard/courses/korean?course=korean-level-one'])assert.equal(courseReturnHref(path),path);
  for(const path of [undefined,'https://example.com','//example.com','/\\example.com','/dashboard/courses/../admin','/dashboard/courses/%2e%2e/admin','/dashboard/admin','/dashboard/courses?redirect=x'])assert.equal(courseReturnHref(path),null);
});
