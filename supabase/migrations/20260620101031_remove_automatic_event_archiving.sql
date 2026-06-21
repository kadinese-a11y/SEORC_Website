-- Events remain active after their date until an admin explicitly publishes and archives them.
select cron.unschedule(jobid)
from cron.job
where jobname = 'archive-and-expire-achieved-events';

-- Archived records are still cleaned up after twelve months, without touching active events.
select cron.schedule(
  'expire-achieved-events-after-12-months',
  '5 0 * * *',
  $$delete from public.achieved_events where archived_at < now() - interval '12 months'$$
);
