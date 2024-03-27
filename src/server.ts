import fastify from "fastify";
import { z } from 'zod';
import { sql } from "./lib/postgres";
import postgres from "postgres";
import { redis } from "./lib/redis";

const app = fastify();

//ranking 
app.get('/api/metrics', async (request, reply)=>{
    const result = await redis.zRangeByScoreWithScores('metrics', 0, 50);
    const metrics = result.sort((a, b) => b.score - a.score)
    return reply.status(200).send({
        data: metrics
    })
});
//redirect
app.get('/:code', async (request, reply)=>{
        const { code } = z.object({code:z.string().min(3)}).parse(request.params);
        const result = await sql/* sql */ `
            SELECT id, original_url
            FROM shorts_links
            WHERE code = ${code}
        `;
        if(result.length===0){
            return reply.status(404).send({
                message: 'Link Not Found'
            }); 
        }
        const link = result[0];
        await redis.zIncrBy('metrics', 1, String(link.id));
        return reply.redirect(301, link.original_url);
});

// list
app.get('/api/links', async (request, reply)=>{
    try {
        const result = await sql/* sql */ `
            SELECT * 
            FROM shorts_links
            ORDER BY created_at DESC
        `;

        return reply.status(200).send({
            data: result
        })
   
    } catch (err) {
        return reply.status(404).send({
            message: 'Not Found'
        });
    }
});
// create
app.post('/api/links', async (request, reply)=>{
    const createShortLinkSchema = z.object({
        code: z.string().min(3),
        url: z.string().url(),
    });

    const { code, url } = createShortLinkSchema.parse(request.body);

    if (code )

    try {
        const result = await sql/* sql */ `
            INSERT INTO shorts_links(
                code, original_url
            )VALUES(
                ${code},
                ${url}
            )
            RETURNING id, code, original_url
        `;

        const shortLinkJson = {
            'id': result[0],
            'code': result[1],
            'url': result[2]
        }
    
        return reply.status(201).send({
            data: shortLinkJson
        })
   
    } catch (err) {
        if (err instanceof postgres.PostgresError){
            if (err.code === '23505') {
                return reply.status(400).send({
                    message: 'Duplicate code!'
                });
            }
        }
    }

});


app.listen({
    port:3001,
}).then(()=>{
    console.log('HTTP Server running!');
});