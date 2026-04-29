export interface ProfilesPublisher<Plan, Result, Options> {
  plan(options: Options): Promise<Plan>;
  publish(options: Options & { dryRun: boolean }): Promise<Result>;
}
