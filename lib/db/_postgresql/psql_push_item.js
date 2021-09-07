//
//	PSQL Push logic Database Functions
//

class PSqlPushItem {
	static deps() { return {services:[ ]}; }
	constructor(core, kit){
		this.db= core;
		this.table= 'push_item';
		const common=[ 'route_slice', 'payload', ];
		this.schema= {
			recent:[ '*'],
			create:[ ...common, ],
			next:[ 'id', ...common, ],
		};
		this.db.method_factory(this, 'PSqlPushItem');
	}

	async delete_by_route( ctx, route){
		const f= "DB:PSqlPushItem:delete_by_route:";
		ctx.log.debug( f, {route});

		const sql= `DELETE FROM ${this.table} WHERE route_slice LIKE ?`;
		return await this.db.sqlQuery( ctx, sql, [ route ]);
	}


	// Grabs the most recent record's id
	async GetMostRecentCount( ctx){
		const f= "DB:PSqlPushItem:GetMostRecentCount:";
		ctx.log.debug( f, {});

		const sql= `
			SELECT id FROM ${this.table}
  				WHERE di= 0
  				ORDER BY id DESC LIMIT 1
			`;
		return await this.db.sqlQuery( ctx, sql, [ ]);
	}

	// Grabs the last N recent changes
	async GetMostRecentChanges( ctx, limit){
		const f= "DB:PSqlPushItem:GetMostRecentChanges:";
		ctx.log.debug( f, {limit});

		// TODO CONSIDER USING NODEJS TO REVERSE THE ORDER OF THIS ARRAY VS. SUB SELECT
		const sql= `
			SELECT ${this.schema.next}
			FROM (SELECT * FROM ${this.table}
  				WHERE di= 0
  				ORDER BY id DESC LIMIT ?) sub
			ORDER BY id ASC
			`;
		return await this.db.sqlQuery( ctx, sql, [ limit]);
	}

	// Get the next set of route:slice changes
	// from: the id that you would like to start getting changes from
	// limit: how many records you want to limit the response to
	async GetNext( ctx, from, limit){
		const f= "DB:PSqlPushItem:GetNext:";
		const args= [];
		let sql_from= '';
		let sql_limit= '';

		if (typeof from === 'number') {
			sql_from= ' AND id > ?';
			args.push(from);
		}

		if (typeof limit === 'number') {
			sql_limit= 'LIMIT ?';
			args.push(limit);
		}

		const sql= `
			SELECT ${this.schema.next}
			FROM ${this.table}
			WHERE di= 0 ${sql_from} 
			${sql_limit}
			`;
		return await this.db.sqlQuery( ctx, sql, args);
	}
}

exports.PSqlPushItem= PSqlPushItem;
