import './index.css'
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import advancedFormat from "dayjs/plugin/advancedFormat";
dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(advancedFormat);
const Reply = (reply) => {
    reply = reply.reply;
    return (
        <div className='reply'>
            <div className="font-bold">{reply.actor?.profile?.name}</div>
            <div dangerouslySetInnerHTML={{ __html: reply.body }}></div>
            <div className='text-right'>{dayjs().to(reply.createdAt)}</div>
        </div>
    )
}

export default Reply