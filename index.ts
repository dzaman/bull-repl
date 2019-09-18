/// <reference types="./src/typing" />

import {
  ConnectParams,
  ActiveParams,
  WaitingParams,
  CompletedParams,
  FailedParams,
  DelayedParams,
  GetParams,
  AddParams,
  Answer,
  RmParams,
  RetryParams,
  PromoteParams,
  FailParams,
  CompleteParams,
  CleanParams,
  LogsParams,
  LogParams
} from "./src/types";
import Queue, { Queue as TQueue } from "bull";
import chalk from "chalk";
import Vorpal, { CommandInstance } from "vorpal";
import ms from "ms";
import {
  showJobs,
  getFilter,
  getTimeAgoFilter,
  searchjsLink,
  msLink,
  logArray
} from "./src/utils";

export const vorpal = new Vorpal();
let queue: TQueue;

const checkQueue = async () => {
  if (!queue) {
    let err = new Error();
    err.stack = chalk.yellow("Need connect before");
    throw err;
  }
  return await queue.isReady();
};

const getJob = async (jobId: string) => {
  const job = await queue.getJob(jobId);
  if (!job) {
    let err = new Error();
    err.stack = chalk.yellow(`Job "${jobId}" not found`);
    throw err;
  }
  return job;
};

vorpal
  .command("connect <queue>", "connect to bull queue")
  .option("-p, --prefix <prefix>", "prefix to use for all queue jobs")
  .option("-r, --redis <redis>", "host:port of redis, default localhost:6379")
  .action((async ({ queue: name, options }: ConnectParams) => {
    queue && queue.close();
    const url = options.redis
      ? `redis://${options.redis}`
      : "redis://localhost:6379";
    queue = Queue(name, url, { prefix: options.prefix });
    await queue.isReady();
    const prefix = options.prefix || "bull";
    console.log(
      chalk.green(`Connected to ${url}, prefix: ${prefix}, queue: ${name}`)
    );
    vorpal.delimiter(`BULL-REPL | ${prefix}.${name}> `).show();
  }) as any);

vorpal.command("stats", "count of jobs by groups").action(async () => {
  await checkQueue();
  console.table(await queue.getJobCounts());
});

vorpal
  .command("active", "fetch active jobs")
  .option("-f, --filter <filter>", `filter jobs via ${searchjsLink}`)
  .option("-ta, --timeAgo <timeAgo>", `get jobs since time ago via ${msLink}`)
  .action(async ({ options }: ActiveParams) => {
    await checkQueue();
    const filter = await getFilter(options.filter);
    const timeAgoFilter = await getTimeAgoFilter(options.timeAgo);
    showJobs(await queue.getActive(), { ...filter, ...timeAgoFilter });
  });

vorpal
  .command("waiting", "fetch waiting jobs")
  .option("-f, --filter <filter>", `filter jobs via ${searchjsLink}`)
  .option("-ta, --timeAgo <timeAgo>", `get jobs since time ago via ${msLink}`)
  .action(async ({ options }: WaitingParams) => {
    await checkQueue();
    const filter = await getFilter(options.filter);
    const timeAgoFilter = await getTimeAgoFilter(options.timeAgo);
    showJobs(await queue.getWaiting(), { ...filter, ...timeAgoFilter });
  });

vorpal
  .command("completed", "fetch completed jobs")
  .option("-f, --filter <filter>", `filter jobs via ${searchjsLink}`)
  .option("-ta, --timeAgo <timeAgo>", `get jobs since time ago via ${msLink}`)
  .action(async ({ options }: CompletedParams) => {
    await checkQueue();
    const filter = await getFilter(options.filter);
    const timeAgoFilter = await getTimeAgoFilter(options.timeAgo);
    showJobs(await queue.getCompleted(), { ...filter, ...timeAgoFilter });
  });

vorpal
  .command("failed", "fetch failed jobs")
  .option("-f, --filter <filter>", `filter jobs via ${searchjsLink}`)
  .option("-ta, --timeAgo <timeAgo>", `get jobs since time ago via ${msLink}`)
  .action(async ({ options }: FailedParams) => {
    await checkQueue();
    const filter = await getFilter(options.filter);
    const timeAgoFilter = await getTimeAgoFilter(options.timeAgo);
    showJobs(await queue.getFailed(), { ...filter, ...timeAgoFilter });
  });

vorpal
  .command("delayed", "fetch delayed jobs")
  .option("-f, --filter <filter>", `filter jobs via ${searchjsLink}`)
  .option("-ta, --timeAgo <timeAgo>", `get jobs since time ago via ${msLink}`)
  .action(async ({ options }: DelayedParams) => {
    await checkQueue();
    const filter = await getFilter(options.filter);
    const timeAgoFilter = await getTimeAgoFilter(options.timeAgo);
    showJobs(await queue.getDelayed(), { ...filter, ...timeAgoFilter });
  });

vorpal.command("get <jobId>", "get job").action((async ({
  jobId
}: GetParams) => {
  await checkQueue();
  const job = await getJob(jobId);
  showJobs([job], {});
}) as any);

vorpal
  .command("add <data>", "add job to queue")
  .option("-n, --name <name>", "name for named job")
  .action(async function(this: CommandInstance, { data, options }: AddParams) {
    await checkQueue();
    let jobData: object;
    try {
      jobData = JSON.parse(data);
    } catch (e) {
      let err = new Error();
      err.stack = chalk.yellow(`Error occured, seems "data" incorrect json`);
      throw err;
    }
    const answer = (await this.prompt({
      name: "a",
      message: "Add? (y/n): "
    })) as Answer;
    if (answer.a !== "y") {
      return;
    }
    const jobName: string = options.name || "__default__";
    const addedJob = await queue.add(jobName, jobData);
    console.log(
      chalk.green(`Job with name '${jobName}', id '${addedJob.id}' added`)
    );
  } as any);

vorpal
  .command("rm <jobId>", "remove job")
  .action(async function(this: CommandInstance, { jobId }: RmParams) {
    await checkQueue();
    const job = await getJob(jobId);
    const answer = (await this.prompt({
      name: "a",
      message: "Remove? (y/n): "
    })) as Answer;
    if (answer.a !== "y") {
      return;
    }
    await job.remove();
    console.log(chalk.green(`Job "${jobId}" removed`));
  } as any);

vorpal
  .command("retry <jobId>", "retry job")
  .action(async function(this: CommandInstance, { jobId }: RetryParams) {
    await checkQueue();
    const job = await getJob(jobId);
    const answer = (await this.prompt({
      name: "a",
      message: "Retry? (y/n): "
    })) as Answer;
    if (answer.a !== "y") {
      return;
    }
    await job.retry();
    console.log(chalk.green(`Job "${jobId}" retried`));
  } as any);

vorpal
  .command("promote <jobId>", "promote job")
  .action(async function(this: CommandInstance, { jobId }: PromoteParams) {
    await checkQueue();
    const job = await getJob(jobId);
    const answer = (await this.prompt({
      name: "a",
      message: "Promote? (y/n): "
    })) as Answer;
    if (answer.a !== "y") {
      return;
    }
    await job.promote();
    console.log(chalk.green(`Job "${jobId}" promoted`));
  } as any);

vorpal
  .command("fail <jobId> <reason>", "fail job")
  .action(async function(this: CommandInstance, { jobId, reason }: FailParams) {
    await checkQueue();
    const job = await getJob(jobId);
    const answer = (await this.prompt({
      name: "a",
      message: "Fail? (y/n): "
    })) as Answer;
    if (answer.a !== "y") {
      return;
    }
    await job.moveToFailed({ message: reason }, true);
    console.log(chalk.green(`Job "${jobId}" failed`));
  } as any);

vorpal
  .command("complete <jobId> <data>", "complete job")
  .action(async function(
    this: CommandInstance,
    { jobId, data }: CompleteParams
  ) {
    await checkQueue();
    const job = await getJob(jobId);
    let returnValue: string;
    try {
      returnValue = JSON.parse(data);
    } catch (e) {
      let err = new Error();
      err.stack = chalk.yellow(`Error occured, seems "data" incorrect json`);
      throw err;
    }
    const answer = (await this.prompt({
      name: "a",
      message: "Complete? (y/n): "
    })) as Answer;
    if (answer.a !== "y") {
      return;
    }
    await job.moveToCompleted(returnValue, true);
    console.log(chalk.green(`Job "${jobId}" completed`));
  } as any);

vorpal
  .command(
    "clean <period>",
    `Clean queue for period ago, period format - ${msLink}`
  )
  .option(
    "-s, --status <status>",
    "Status of the job to clean, default: completed"
  )
  .option(
    "-l, --limit <limit>",
    "Maximum amount of jobs to clean per call, default: all"
  )
  .action(async function(
    this: CommandInstance,
    { period, options }: CleanParams
  ) {
    await checkQueue();
    const answer = (await this.prompt({
      name: "a",
      message: "Clean? (y/n): "
    })) as Answer;
    if (answer.a !== "y") {
      return;
    }
    const grace = period && period.length ? ms(period as string) : void 0;
    if (!grace) {
      return console.log(chalk.yellow("Incorrect period"));
    }
    const status = options.status || "completed";
    if (
      !["completed", "wait", "active", "delayed", "failed"].includes(status)
    ) {
      return console.log(
        chalk.yellow(
          "Incorrect status, should be: completed or wait or active or delayed or failed"
        )
      );
    }
    const limit = Number.isInteger(options.limit as number)
      ? options.limit
      : void 0;
    await queue.clean(grace, status, limit);
    console.log(chalk.green(`Jobs cleaned`));
  } as any);

vorpal
  .command("logs <jobId>", "get logs of job")
  .option("-s, --start <start>", "Start of logs")
  .option("-e, --end <end>", "End of logs")
  .action((async ({ jobId, options }: LogsParams) => {
    await checkQueue();
    const { logs, count } = await queue.getJobLogs(
      jobId,
      options.start,
      options.end
    );
    console.log(`Count of job logs: ${count}`);
    if (logs.length) {
      console.log("Logs:");
      logArray(logs);
    }
  }) as any);

vorpal
  .command("log <jobId> <data>", "add log to job")
  .action(async function(this: CommandInstance, { jobId, data }: LogParams) {
    await checkQueue();
    const job = await getJob(jobId);
    const answer = (await this.prompt({
      name: "a",
      message: "Add log? (y/n): "
    })) as Answer;
    if (answer.a !== "y") {
      return;
    }
    await job.log(data);
    console.log(chalk.green("Log added to job"));
  } as any);

vorpal.history("bull-repl-default");
vorpal.delimiter("BULL-REPL> ").show();
