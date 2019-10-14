
DROP   TABLE IF EXISTS runqueue;
CREATE TABLE runqueue (
	 id		INT(10)			NOT NULL AUTO_INCREMENT PRIMARY KEY
	,di		TINYINT    		DEFAULT 0 NOT NULL /* 'disposal' - 0:none,1:disabled,2:purge*/
	,cr		TIMESTAMP		DEFAULT 0 /* 'created' Must be first TIMESTAMP colum */
	,mo		TIMESTAMP		DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP /* 'modified' */

    ,unique_key          VARCHAR(255)   DEFAULT NULL /* An arbitrary ID used for job uniqueness and lookup.  Must be unique across topics/jobs or null*/

	,topic				VARCHAR( 128)	DEFAULT NULL /* Which topic to inform to process this job */
	,group_ref			VARCHAR( 128)	DEFAULT NULL /* Which group for connection-limit counts */

	,in_process			TINYINT			DEFAULT 0		NOT NULL /* 0:not-running,1:running*/
	,priority			INT( 5)			DEFAULT 1000	NOT NULL /* */
	,run_at				TIMESTAMP		DEFAULT 0

	,retries			INT( 3)			DEFAULT 0		NOT NULL
	,fail_at			TIMESTAMP	NULL DEFAULT NULL		/* When will we conclude caller has crashed */
	,last_reason		TEXT			DEFAULT NULL	/* On app error, reason string for next run if needed */

	,json			    TEXT			DEFAULT NULL	/* Caller's info, such as text-message, email-data */
) ENGINE = INNODB ;

CREATE INDEX ix_runqueue__next_job ON runqueue(in_process,priority,run_at); /* Can be used to select just the one next job to do */
CREATE UNIQUE INDEX ix_runqueue__unique_key ON runqueue(unique_key); /* For App to query specific jobs in the queue */

