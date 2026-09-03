export const SET_IF_NEWER = `
  local key = KEYS[1]
  local new_value = ARGV[1]
  local new_version = tonumber(ARGV[2])
  local current_version = tonumber(redis.call('HGET', key, 'version') or '0')

  if new_version > current_version then
    redis.call('HSET', key, 'value', new_value, 'version', new_version, 'dirty', '1')
    return 1
    
  else
    return 0
  end
`;

export const CLEAR_DIRTY_IF_UNCHANGED = `
  local key = KEYS[1]
  local flushed_version = tonumber(ARGV[1])
  local current_version = tonumber(redis.call('HGET', key, 'version') or '0')

  if current_version == flushed_version then
    redis.call('HSET', key, 'dirty', '0')
    return 1
  else
    return 0
  end
`;

declare module 'ioredis' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface RedisCommander<Context> {
    setIfNewer(key: string, value: string, version: number): Promise<number>;
    clearDirtyIfUnchanged(key: string, flushedVersion: number): Promise<number>;
  }
}
