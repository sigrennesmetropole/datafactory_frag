import { createReadStream, readdirSync } from 'fs';
import path from 'path';
import { Readable } from 'stream';
import S3 from 'aws-sdk/clients/s3';
import { IDriver, IFile } from '.';
import { PromiseResult } from 'aws-sdk/lib/request';
import { AWSError } from 'aws-sdk/lib/error';

export interface IS3Config {
  host: string;
  access_key: string;
  secret_key: string;
}

export class S3Driver implements IDriver {
  private _s3_src: S3;
  private _s3_dst: S3;
  /**
   * @param src the S3 bucket to read objects from
   * @param dst the S3 bucket to write chunks to (if none, `src` is used)
   */
  constructor(src: IS3Config, dst?: IS3Config) {
    this._s3_src = new S3({
      accessKeyId: src.access_key,
      secretAccessKey: src.secret_key,
      endpoint: src.host,
      // FIXME add the following as configurable: for now, it is Min.IO specific
      s3ForcePathStyle: true,
      signatureVersion: 'v4',
    });

    if (dst) {
      this._s3_dst = new S3({
        accessKeyId: dst.access_key,
        secretAccessKey: dst.secret_key,
        endpoint: dst.host,
        // FIXME add the following as configurable: for now, it is Min.IO specific
        s3ForcePathStyle: true,
        signatureVersion: 'v4',
      });
    } else {
      this._s3_dst = this._s3_src;
    }
  }

  async listObjects(bucket: string, Prefix = ''): Promise<IFile[]> {
    const files: IFile[] = [];
    let StartAfter: string | undefined;
    let res: PromiseResult<S3.ListObjectsV2Output, AWSError>;
    while (
      (res = await this._s3_src
        .listObjectsV2({ Bucket: bucket, Prefix, StartAfter })
        .promise()) &&
      res.Contents &&
      res.Contents.length > 0
    ) {
      files.push(
        ...res.Contents.map((o) => ({
          name: o.Key!, // eslint-disable-line @typescript-eslint/no-non-null-assertion
          size: o.Size!, // eslint-disable-line @typescript-eslint/no-non-null-assertion
        }))
      );
      StartAfter = res.Contents[res.Contents.length - 1].Key!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
    }
    return files;
  }

  getObject(bucket: string, objKey: string): Readable {
    return this._s3_src
      .getObject({ Bucket: bucket, Key: objKey })
      .createReadStream();
  }

  async writeObject(
    filepath: string,
    targetBucket: string,
    objKey: string,
    prefix = ''
  ): Promise<void> {
    console.log("Deletion of headers from aggregated file")   // We start the process for delete all the header
    var filenamesGz = readdirSync('/tmp/')  // We recover the aggregated compressed files which will be write in minio
   
    for (const file of filenamesGz){ 
      if(file.includes("frag-chunk-")){
        await execShellcmd(`gunzip /tmp/${file}`, "dezippage du fichier...")  // we start by unzipping all the file that are zipped for modified them
      }
    }    
    var filenamesCSV =readdirSync('/tmp')

    for (const file of filenamesCSV){ 
      if(file.includes("frag-chunk-")){
        await execShellcmd(`sed '/^datetime/d' -i /tmp/${file}`,"effacement des headers...")  //we scan each of the uncompressed file and delete lines which start by datetime (line with header)
      }
    }

    for (const file of filenamesCSV){
      if(file.includes("frag-chunk-")){
        await execShellcmd(`sed '1idatetime;predefinedLocationReference;averageVehicleSpeed;travelTime;travelTimeReliability;trafficStatus;vehicleProbeMeasurement' -i /tmp/${file}`,"Mise en place d'un header au debut") // we had at the start of each file our header
      }
    }

    for (const file of filenamesCSV){
      if(file.includes("frag-chunk-")){
        await execShellcmd(`gzip /tmp/${file}`,"Rezippage du fichier ...") // We gzip each file for them to be ready to be wrote in minio
      }
    }
  
    await this._s3_dst
      .putObject({  // Writting in minio
        Bucket: targetBucket,
        Key: path.join(prefix, objKey),
        Body: createReadStream(filepath),
      })
      .promise();
    return;
  }

  async deleteObjects(bucket: string, files: IFile[]): Promise<void> {
    await this._s3_src
      .deleteObjects({
        Bucket: bucket,
        Delete: {
          Objects: files.map((f) => ({ Key: f.name })),
        },
      })
      .promise();
    return;
  }

  info(): string {
    return `s3 [src=${this._s3_src.endpoint.href}, dst=${this._s3_dst.endpoint.href}]`;
  }

  get src(): S3 {
    return this._s3_src;
  }

  get dst(): S3 {
    return this._s3_dst;
  }
}

/**
 * Function that execute a shell command on a child process
 * @param cmd command shell that will be executed
 * @param message message that will be printed in the console
 * @returns a promise of the process
 */
 function execShellcmd(cmd:string, message:string){
  //console.log(`Commande lancer: ${cmd}`);
  const { exec } = require("child_process");
  const promise = new Promise( (resolve, reject)=> {
    exec(cmd, (error: { message: any; }, /*stdout: any,*/ stderr: any) => {
      console.log(message)
      if (error) {
          console.log(`error: ${error.message}`);
          reject("Something went wrong")
      }
      if (stderr) {
          console.log(`stderr: ${stderr}`);
          reject("Something went wrong")
      }
      //console.log(`Commande faite: ${cmd} \n${stdout}`);
      resolve('Ok')
    });
  })
  return promise
}