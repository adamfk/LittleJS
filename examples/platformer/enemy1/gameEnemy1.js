'use strict';

class Enemy1 extends GameObject 
{
    constructor(pos)
    { 
        super(pos, vec2(.9,.9), spriteAtlas['enemy']);

        this.drawSize = vec2(1);
        this.color = hsl(rand(), 1, .7);
        this.health = 5;
        this.swellSpeed = 6;
        this.swellTimer = new Timer(rand(1e3));
        this.setCollision(true, false);
        this.sm = new Enemy1Sm();
        this.sm.vars.obj = this;
        this.spawnPos = pos.copy();
        this.patrolVec = vec2(0.05,0);
        this.patrolRange = 7;

        this.sm.start();
    }

    playerDist()
    {
        return this.pos.distance(player.pos);
    }

    jumpAround()
    {
        // jump around randomly
        if (this.groundObject && rand() < 0.02)
        {
            this.velocity = vec2(rand(.1,-.1), rand(.4, .2));
            sound_jump.play(this.pos, .4, 2);
        }
    }

    isPatrolEnd()
    {
        if (this.willHitTile(this.patrolVec))
            return true;

        // TODO check if will fall off edge

        const distanceToSpawn = this.pos.distance(this.spawnPos);
        const nextDistanceToSpawn = this.pos.add(this.patrolVec).distance(this.spawnPos);
        const isBeyondPatrolRange = distanceToSpawn >= this.patrolRange;
        const isMovingAwayFromSpawn = nextDistanceToSpawn >= distanceToSpawn;
        return isBeyondPatrolRange && isMovingAwayFromSpawn;
    }

    willHitTile(vec)
    {
        // vec = vec.normalize();
        vec = vec.copy();
        vec.x += sign(vec.x) * this.size.x/2;
        const pos = this.pos.add(vec);
        return tileCollisionTest(pos, this.size);
    }

    doPatrolMarch()
    {
        this.velocity.x = this.patrolVec.x;
    }

    patrolTurn()
    {
        this.patrolVec.x *= -1;
    }

    doHuntPlayer()
    {
        const vecToPlayer = this.normVecToPlayer();

        // if in air, drift towards player
        if (!this.groundObject)
        {
            this.velocity.x += vecToPlayer.x * .001;
        }
        else
        {
            // on ground. randomly jump towards player
            if (rand() < 0.01)
            {
                this.jumpTowardsPlayer(vecToPlayer);
            }
            else
            {
                // if not jumping, march towards player
                this.velocity = vecToPlayer.multiply(vec2(.07, .0));
            }
        }
    }

    normVecToPlayer() {
        return player.pos.subtract(this.pos).normalize();
    }

    /**
     * @param {vec2?} vecToPlayer 
     */
    jumpTowardsPlayer(vecToPlayer)
    {
        if (!vecToPlayer)
            vecToPlayer = this.normVecToPlayer();

        const jumpYSpeed = rand(.4, .2);
        const jumpXSpeed = rand(.07, .2);
        this.velocity = vecToPlayer.multiply(vec2(jumpXSpeed, 0));
        this.velocity.y = jumpYSpeed;
        sound_jump.play(this.pos, .4, 2);
    }

    smallVerticalHop()
    {
        this.velocity.y = .1;
        this.velocity.x = 0;
        sound_jump.play(this.pos, .4, 2);
    }

    damage(damage, damagingObject)
    {
        super.damage(damage, damagingObject);
        this.sm.dispatchEvent(Enemy1Sm.EventId.DAMAGED);

        if (!this.isDead() && this.groundObject)
        {
            this.jumpTowardsPlayer();
        }
    }
    
    update()
    {
        super.update();
        
        if (!player)
            return;

        this.sm.dispatchEvent(Enemy1Sm.EventId.DO);

        // damage player if touching
        if (isOverlapping(this.pos, this.size, player.pos, player.size))
        {
            player.damage(1, this);
        }

        if (player.isDead())
            this.sm.dispatchEvent(Enemy1Sm.EventId.PLAYER_DEAD);
    }

    kill()
    {
        if (this.destroyed)
            return;

        ++score;
        sound_score.play(this.pos);
        makeDebris(this.pos, this.color);
        this.destroy();
    }
    
    render()
    {
        // bounce by changing size
        const bounceTime = this.swellTimer * this.swellSpeed;
        this.drawSize = vec2(1-.1*Math.sin(bounceTime), 1+.1*Math.sin(bounceTime));
        // this.drawSize = vec2(1,1);

        // make bottom flush
        let bodyPos = this.pos;
        bodyPos = bodyPos.add(vec2(0,(this.drawSize.y-this.size.y)/2));
        drawTile(bodyPos, this.drawSize, this.tileInfo, this.color, this.angle, this.mirror, this.additiveColor);

        const debugClosest = true;
        if (debugClosest) {
            if (this.playerDist() < 20)
            {
                window.debugEnemy = this;
            }
            else
            {
                // this.destroy();
            }
        }
    }
}
