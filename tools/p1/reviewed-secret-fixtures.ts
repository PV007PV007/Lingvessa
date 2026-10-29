import {createHash} from 'node:crypto';

/** Exact-content false-positive triage; never a path-wide or rule-wide exclusion. */
export function reviewedNonSecretFixture(location:string,bytes:Buffer):string[] {
 const path=location.replace(/^history:[0-9a-f]{12}:/,'');
 if(path!=='tests/unit/p5-private-transfer.test.py')return [];
 // This complete, reviewed file contains only an artificial user/password URL used to
 // assert credential-bearing redirects are rejected. All network calls are mocked.
 // Any byte change invalidates this decision, including another credential in this file.
 const checksum=createHash('sha256').update(bytes).digest('hex');
 // Retain the earlier blob for full-history scans. The second reviewed revision
 // adds mocked pinned-release/asset checks and contains the same artificial URL.
 const reviewedChecksums=new Set([
  '6136de229e691719b1cf63d8edc2c264007960545d7955ee1020ebf55c014a97',
  'cd8b53b86ef581355954b93a7e0aaf9e782e8652e30a0613777f00b3e4e7109f',
 ]);
 return reviewedChecksums.has(checksum)?['credential-url']:[];
}
